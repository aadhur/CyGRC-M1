from uuid import UUID

from app.api.deps import get_tenant_and_user, require_scope
from app.db.models import (
    Audit,
    AuditControlReview,
    AuditScopeControl,
    AuditStatusEnum,
    Control,
)
from app.db.session import get_db
from app.schemas.audits import AuditControlResponse, AuditResponseSchema, AuditSchema
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from uuid6 import uuid7

router = APIRouter()


@router.post(
    "",
    response_model=AuditResponseSchema,
    status_code=status.HTTP_201_CREATED,
    dependencies=[
        Depends(HTTPBearer()),
        Depends(require_scope("audits:write")),
    ],
)
async def create_audit_cycle(
    payload: AuditSchema,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    tenant_user: tuple[UUID, UUID] = Depends(get_tenant_and_user),
):
    tenant_id, _ = tenant_user

    try:
        # 1. Instantiate Audit Cycle (tenant_id is handled by model/RLS default)
        audit = Audit(
            audit_id=uuid7(),
            tenant_id=tenant_id,
            framework_id=payload.framework_id,
            period_start=payload.period_start,
            period_end=payload.period_end,
            status=AuditStatusEnum.PLANNING,
        )
        db.add(audit)
        await db.flush()

        # 2. Populate audit_scope_controls junction table
        if payload.control_ids:
            scope_entries = [
                AuditScopeControl(
                    audit_id=audit.audit_id, control_id=cid, tenant_id=tenant_id
                )
                for cid in payload.control_ids
            ]
            db.add_all(scope_entries)

        await db.commit()

        return AuditResponseSchema(
            audit_id=audit.audit_id,
            status=AuditStatusEnum.PLANNING,
            scoped_control_count=len(payload.control_ids),
        )

    except HTTPException:
        await db.rollback()
        raise

    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Audit could not be created because of a database constraint violation.",
        )

    except SQLAlchemyError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error while creating audit. Role: {e}",
        ) from e


@router.get(
    "/{audit_id}/controls",
    response_model=list[AuditControlResponse],
    dependencies=[
        Depends(HTTPBearer()),
        Depends(require_scope("audits:read")),
    ],
)
async def list_audit_scoped_controls(
    audit_id: UUID,
    db: AsyncSession = Depends(get_db),  # noqa: B008
):
    try:
        stmt = (
            select(Control, AuditControlReview)
            .join(
                AuditScopeControl,
                AuditScopeControl.control_id == Control.control_id,
            )
            .outerjoin(
                AuditControlReview,
                (AuditControlReview.audit_id == audit_id)
                & (AuditControlReview.control_id == Control.control_id),
            )
            .where(AuditScopeControl.audit_id == audit_id)
        )

        result = await db.execute(stmt)
        rows = result.all()

        if not rows:
            # Verify if audit cycle exists at all
            audit_exists = await db.execute(
                select(Audit.audit_id).where(Audit.audit_id == audit_id)
            )

            if not audit_exists.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Audit cycle not found",
                )

        return [
            AuditControlResponse(
                control=control,
                review=review,
            )
            for control, review in rows
        ]

    except HTTPException:
        raise

    except SQLAlchemyError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while retrieving audit controls.",
        ) from e


# Note: Adjust these imports based on your exact project structure
from app.api.dependencies import get_db, get_tenant_and_user
from app.db import models
from app.schemas import audits as schemas
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

router = APIRouter()

# ==========================================
# ROSHAN's ENDPOINTS (Issue #101)
# ==========================================


@router.post("/{id}/controls/{control_id}/review", status_code=status.HTTP_200_OK)
def review_audit_control(
    id: UUID,
    control_id: UUID,
    review_in: schemas.ControlReviewCreate,  # <-- Update with Vaibhavi's actual schema name
    db: Session = Depends(get_db),  # noqa: B008
    tenant_user: tuple[UUID, UUID] = Depends(get_tenant_and_user),
):
    """
    Scope: audits:write
    Inserts or updates a record in audit_control_reviews.
    """
    tenant_id, _ = tenant_user  # Used _ for unused user_id

    # Automatic RLS rule: Do NOT filter by tenant_id
    existing_review = (
        db.query(models.AuditControlReview)
        .filter(
            models.AuditControlReview.audit_id == id,
            models.AuditControlReview.control_id == control_id,
        )
        .first()
    )

    if existing_review:
        # Update existing record
        existing_review.verdict = review_in.verdict
        existing_review.notes = review_in.notes
        db.commit()
        db.refresh(existing_review)
        return existing_review
    else:
        # Insert new record (Use tenant_id ONLY for insertion per rules)
        new_review = models.AuditControlReview(
            tenant_id=tenant_id,
            audit_id=id,
            control_id=control_id,
            verdict=review_in.verdict,
            notes=review_in.notes,
        )
        db.add(new_review)
        db.commit()
        db.refresh(new_review)
        return new_review


@router.post("/{id}/findings", status_code=status.HTTP_201_CREATED)
def create_finding(
    id: UUID,
    finding_in: schemas.FindingCreate,  # <-- Update with Vaibhavi's actual schema name
    db: Session = Depends(get_db),  # noqa: B008
    tenant_user: tuple[UUID, UUID] = Depends(get_tenant_and_user),
):
    """
    Scope: audits:write
    Creates a new finding for an audit.
    """
    tenant_id, _ = tenant_user  # Used _ for unused user_id

    new_finding = models.Finding(
        tenant_id=tenant_id,  # Insert rule applied
        audit_id=id,
        control_id=finding_in.control_id,
        severity=finding_in.severity,
        description=finding_in.description,
        recommendation=finding_in.recommendation,
        owner=finding_in.owner,
        due_date=finding_in.due_date,
    )
    db.add(new_finding)
    db.commit()
    db.refresh(new_finding)
    return new_finding


@router.patch("/{id}/findings/{finding_id}", status_code=status.HTTP_200_OK)
def update_finding_status(
    id: UUID,
    finding_id: UUID,
    finding_update: schemas.FindingUpdate,  # <-- Update with Vaibhavi's actual schema name
    db: Session = Depends(get_db),  # noqa: B008
    tenant_user: tuple[UUID, UUID] = Depends(get_tenant_and_user),
):
    """
    Scope: audits:write
    Updates the remediation status of a specific finding.
    """
    _, _ = tenant_user  # Both unused, endpoint does not filter by tenant_id

    # Automatic RLS rule: Do NOT filter by tenant_id
    finding = (
        db.query(models.Finding)
        .filter(models.Finding.id == finding_id, models.Finding.audit_id == id)
        .first()
    )

    if not finding:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Finding not found"
        )

    finding.status = finding_update.status
    db.commit()
    db.refresh(finding)
    return finding


# ==========================================
