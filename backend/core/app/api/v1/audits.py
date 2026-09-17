from datetime import datetime, timezone
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
    AuditControlReviewCreate,
    AuditControlReviewResponse,
    AuditControlResponse,
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
from sqlalchemy import select, update
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
    "/{id}/controls/{control_id}/review",
    response_model=AuditControlReviewResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[
        Depends(bearer_scheme),
        Depends(require_scope("audits:write")),
    ],
)
async def review_audit_control(
    id: UUID,
    control_id: UUID,
    review_in: AuditControlReviewCreate,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    tenant_user: tuple[UUID, UUID] = Depends(get_tenant_and_user),
):
    """Scope: audits:write. Inserts or updates a record in audit_control_reviews."""
    tenant_id, user_id = tenant_user

    stmt = select(AuditControlReview).where(
        AuditControlReview.audit_id == id,
        AuditControlReview.control_id == control_id,
    )
    result = await db.execute(stmt)
    existing_review = result.scalar_one_or_none()

    if existing_review:
        existing_review.verdict = review_in.verdict
        existing_review.notes = review_in.notes
        existing_review.reviewed_by = user_id
        await db.commit()
        await db.refresh(existing_review)
        return existing_review
    else:
        new_review = AuditControlReview(
            tenant_id=tenant_id,
            audit_id=id,
            control_id=control_id,
            verdict=review_in.verdict,
            notes=review_in.notes,
            reviewed_by=user_id,
        )
        db.add(new_review)
        await db.commit()
        await db.refresh(new_review)
        return new_review


@router.post(
    "/{id}/findings",
    response_model=FindingResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[
        Depends(bearer_scheme),
        Depends(require_scope("audits:write")),
    ],
)
async def create_finding(
    id: UUID,
    finding_in: FindingCreate,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    tenant_user: tuple[UUID, UUID] = Depends(get_tenant_and_user),
):
    """Scope: audits:write. Creates a new finding for an audit."""
    tenant_id, _ = tenant_user

    new_finding = Finding(
        tenant_id=tenant_id,
        audit_id=id,
        control_id=finding_in.control_id,
        severity=finding_in.severity,
        description=finding_in.description,
        recommendation=finding_in.recommendation,
        owner=finding_in.owner,
        due_date=finding_in.due_date,
    )
    db.add(new_finding)
    await db.commit()
    await db.refresh(new_finding)
    return new_finding


@router.patch(
    "/{id}/findings/{finding_id}",
    response_model=FindingResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[
        Depends(bearer_scheme),
        Depends(require_scope("audits:write")),
    ],
)
async def update_finding_status(
    id: UUID,
    finding_id: UUID,
    finding_update: FindingUpdate,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    tenant_user: tuple[UUID, UUID] = Depends(get_tenant_and_user),
):
    """Scope: audits:write. Updates the remediation status of a specific finding."""
    stmt = select(Finding).where(Finding.id == finding_id, Finding.audit_id == id)
    result = await db.execute(stmt)
    finding = result.scalar_one_or_none()

    if not finding:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Finding not found"
        )

    finding.status = finding_update.status
    await db.commit()
    await db.refresh(finding)
    return finding


# ==========================================
# VAIBHAVI's ENDPOINTS (Issue #102) - ASYNC UNIFIED
# ==========================================


@router.post(
    "/{id}/sign-off",
    response_model=AuditSignOffResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[
        Depends(bearer_scheme),
        Depends(require_scope("audits:sign_off")),
    ],
)
async def sign_off_audit(
    id: UUID,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    tenant_user: tuple[UUID, UUID] = Depends(get_tenant_and_user),
):
    """Signs off and closes an audit using auth scope enforcement."""
    _, user_id = tenant_user

    stmt = select(Audit).where(Audit.audit_id == id)
    result = await db.execute(stmt)
    audit = result.scalar_one_or_none()

    if not audit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audit not found",
        )

    audit.status = AuditStatusEnum.CLOSED
    audit.signed_off_by = user_id
    audit.signed_off_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(audit)

    return AuditSignOffResponse(
        audit_id=audit.audit_id,
        status="Closed",
        signed_off_by=audit.signed_off_by,
        signed_off_at=audit.signed_off_at,
    )


@router.post(
    "/{id}/export",
    status_code=status.HTTP_200_OK,
    dependencies=[
        Depends(bearer_scheme),
        Depends(require_scope("audits:read")),
    ],
)
async def export_audit_report_pdf(
    id: UUID,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    tenant_user: tuple[UUID, UUID] = Depends(get_tenant_and_user),
):
    """Generates and streams the audit report as an in-memory PDF download."""
    _, _ = tenant_user

    stmt = select(Audit).where(Audit.audit_id == id)
    result = await db.execute(stmt)
    audit = result.scalar_one_or_none()

    if not audit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audit not found",
        )

    rev_stmt = select(AuditControlReview).where(AuditControlReview.audit_id == id)
    rev_res = await db.execute(rev_stmt)
    reviews = rev_res.scalars().all()

    find_stmt = select(Finding).where(Finding.audit_id == id)
    find_res = await db.execute(find_stmt)
    findings = find_res.scalars().all()

    audit_payload = {
        "audit_id": str(audit.audit_id),
        "title": getattr(audit, "title", "Compliance & Controls Assessment"),
        "framework_name": str(getattr(audit, "framework_id", "Cybersecurity Framework")),
        "period_start": str(getattr(audit, "period_start", "N/A")),
        "period_end": str(getattr(audit, "period_end", "N/A")),
        "status": str(audit.status),
        "summary": "This document details the evaluation of scoped security controls.",
        "controls": [
            {
                "code": str(r.control_id),
                "title": f"Control {r.control_id}",
                "verdict": r.verdict,
                "evidence_summary": r.notes or "No notes provided",
            }
            for r in reviews
        ],
        "findings": [
            {
                "severity": f.severity,
                "description": f.description,
                "recommendation": f.recommendation,
                "status": f.status,
            }
            for f in findings
        ],
        "signed_off_by": str(audit.signed_off_by) if audit.signed_off_by else None,
        "signed_off_at": audit.signed_off_at.strftime("%Y-%m-%d %H:%M:%S UTC")
        if audit.signed_off_at
        else None,
    }

    pdf_buffer = generate_audit_pdf(audit_payload)

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="audit_report_{id}.pdf"'
        },
    )
