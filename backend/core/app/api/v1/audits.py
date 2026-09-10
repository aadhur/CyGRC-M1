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
