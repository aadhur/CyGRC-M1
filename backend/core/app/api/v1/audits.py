from uuid import UUID

from app.api.deps import get_tenant_and_user, require_scope
from app.db.models import (
    Audit,
    AuditControlReview,
    AuditScopeControl,
    AuditStatusEnum,
    Control,
    Finding,
)
from app.db.session import get_db
from app.schemas.audits import (
    AuditControlResponse,
    AuditControlReviewCreate,
    AuditControlReviewResponse,
    AuditResponseSchema,
    AuditSchema,
    AuditSignOffResponse,
    FindingCreate,
    FindingResponse,
    FindingUpdate,
)
from app.services.audit_pdf import generate_audit_pdf
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from uuid6 import uuid7

router = APIRouter()
bearer_scheme = HTTPBearer()

# ==========================================
# AUDIT CYCLE & SCOPE ENDPOINTS
# ==========================================


@router.post(
    "",
    response_model=AuditResponseSchema,
    status_code=status.HTTP_201_CREATED,
    dependencies=[
        Depends(bearer_scheme),
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
            detail=f"Database error while creating audit: {e}",
        ) from e


@router.get(
    "/{audit_id}/controls",
    response_model=list[AuditControlResponse],
    dependencies=[
        Depends(bearer_scheme),
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


# ==========================================
# ROSHAN's ENDPOINTS (Issue #101) - ASYNC UNIFIED
# ==========================================


@router.post(
    "/{audit_id}/controls/{control_id}/review",
    response_model=AuditControlReviewResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[
        Depends(bearer_scheme),
        Depends(require_scope("audits:write")),
    ],
)
async def review_audit_control(
    audit_id: UUID,
    control_id: UUID,
    review_in: AuditControlReviewCreate,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    tenant_user: tuple[UUID, UUID] = Depends(get_tenant_and_user),
):
    """Scope: audits:write. Inserts or updates a record in audit_control_reviews."""
    tenant_id, user_id = tenant_user

    stmt = select(AuditControlReview).where(
        AuditControlReview.audit_id == audit_id,
        AuditControlReview.control_id == control_id,
    )
    result = await db.execute(stmt)
    existing_review = result.scalar_one_or_none()

    if existing_review:
        existing_review.verdict = review_in.verdict
        existing_review.notes = review_in.notes
        existing_review.reviewed_by = user_id
        await db.commit()
        return existing_review
    else:
        new_review = AuditControlReview(
            tenant_id=tenant_id,
            audit_id=audit_id,
            control_id=control_id,
            verdict=review_in.verdict,
            notes=review_in.notes,
            reviewed_by=user_id,
        )
        db.add(new_review)
        await db.commit()
        return new_review


@router.post(
    "/{audit_id}/findings",
    response_model=FindingResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[
        Depends(bearer_scheme),
        Depends(require_scope("audits:write")),
    ],
)
async def create_finding(
    audit_id: UUID,
    finding_in: FindingCreate,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    tenant_user: tuple[UUID, UUID] = Depends(get_tenant_and_user),
):
    """Scope: audits:write. Creates a new finding for an audit."""
    tenant_id, _ = tenant_user

    control_stmt = (
        select(Control.control_id)
        .join(
            AuditScopeControl,
            AuditScopeControl.control_id == Control.control_id,
        )
        .where(
            Control.control_id == finding_in.control_id,
            AuditScopeControl.audit_id == audit_id,
            AuditScopeControl.tenant_id == tenant_id,
        )
    )

    result = await db.execute(control_stmt)
    control_id = result.scalar_one_or_none()

    if control_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Control not found or is not part of this audit.",
        )

    new_finding = Finding(
        finding_id=uuid7(),
        tenant_id=tenant_id,
        audit_id=audit_id,
        control_id=finding_in.control_id,
        severity=finding_in.severity,
        description=finding_in.description,
        recommendation=finding_in.recommendation,
        owner=finding_in.owner,
        due_date=finding_in.due_date,
    )
    db.add(new_finding)
    await db.commit()
    return new_finding


@router.patch(
    "/{audit_id}/findings/{finding_id}",
    response_model=FindingResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[
        Depends(bearer_scheme),
        Depends(require_scope("audits:write")),
    ],
)
async def update_finding_status(
    audit_id: UUID,
    finding_id: UUID,
    finding_update: FindingUpdate,
    db: AsyncSession = Depends(get_db),  # noqa: B008
):
    """Scope: audits:write. Updates the remediation status of a specific finding."""
    stmt = select(Finding).where(
        Finding.finding_id == finding_id, Finding.audit_id == audit_id
    )
    result = await db.execute(stmt)
    finding = result.scalar_one_or_none()

    if not finding:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Finding not found"
        )

    if finding_update.status != "CLOSED":
        finding.status = finding_update.status
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Finding cannot be closed here.",
        )
    await db.commit()
    return finding


# ==========================================
# VAIBHAVI's ENDPOINTS (Issue #102) - ASYNC UNIFIED
# ==========================================


@router.post(
    "/{audit_id}/sign-off",
    response_model=AuditSignOffResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[
        Depends(bearer_scheme),
        Depends(require_scope("audits:write")),
    ],
)
async def sign_off_audit(
    audit_id: UUID,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    tenant_user: tuple[UUID, UUID] = Depends(get_tenant_and_user),
):
    """Signs off and closes an audit using auth scope enforcement."""
    _, user_id = tenant_user

    stmt = select(Audit).where(Audit.audit_id == audit_id)
    result = await db.execute(stmt)
    audit = result.scalar_one_or_none()

    if not audit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audit not found",
        )

    audit.signed_off_by = user_id

    await db.commit()

    return AuditSignOffResponse(
        audit_id=audit.audit_id,
        status=AuditStatusEnum.CLOSED,
        signed_off_by=audit.signed_off_by,
    )


@router.post(
    "/{audit_id}/export",
    status_code=status.HTTP_200_OK,
    dependencies=[
        Depends(bearer_scheme),
        Depends(require_scope("audits:read")),
    ],
)
async def export_audit_report_pdf(
    audit_id: UUID,
    db: AsyncSession = Depends(get_db),  # noqa: B008
):
    """Generates and streams the audit report as an in-memory PDF download."""

    stmt = select(Audit).where(Audit.audit_id == audit_id)
    result = await db.execute(stmt)
    audit = result.scalar_one_or_none()

    if not audit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audit not found",
        )

    rev_stmt = (
        select(AuditControlReview, Control)
        .join(
            Control,
            Control.control_id == AuditControlReview.control_id,
        )
        .where(AuditControlReview.audit_id == audit_id)
    )

    rev_res = await db.execute(rev_stmt)
    review_rows = rev_res.all()

    find_stmt = select(Finding).where(Finding.audit_id == audit_id)
    find_res = await db.execute(find_stmt)
    findings = find_res.scalars().all()

    audit_payload = {
        "audit_id": str(audit.audit_id),
        "title": getattr(audit, "title", "Compliance & Controls Assessment"),
        "framework_name": str(
            getattr(audit, "framework_id", "Cybersecurity Framework")
        ),
        "period_start": str(getattr(audit, "period_start", "N/A")),
        "period_end": str(getattr(audit, "period_end", "N/A")),
        "status": audit.status.value,
        "summary": "This document details the evaluation of scoped security controls.",
        "controls": [
            {
                "code": control.code,
                "title": control.title,
                "description": control.description,
                "verdict": review.verdict.value,
                "evidence_summary": review.notes or "No notes provided",
            }
            for review, control in review_rows
        ],
        "findings": [
            {
                "severity": f.severity,
                "description": f.description,
                "recommendation": f.recommendation,
                "status": f.status.value,
            }
            for f in findings
        ],
        "signed_off_by": (str(audit.signed_off_by) if audit.signed_off_by else None),
    }

    pdf_buffer = generate_audit_pdf(audit_payload)

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="audit_report_{audit_id}.pdf"'
        },
    )
