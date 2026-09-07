from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models import Control
from app.schemas.controls import ControlResponse

router = APIRouter()
# FastAPI security dependency to enable Swagger UI token injection
http_bearer = HTTPBearer()

# NOTE: Replace these placeholder imports with the real tenant-context and scope-check
# dependencies implemented in #B4.1.1. Do NOT add manual tenant filtering (RLS handles isolation).
# from app.api.dependencies import tenant_context, require_scope
# tenant_ctx: TenantContext = Depends(tenant_context)
# _ = Depends(require_scope("controls:read"))

@router.get(
    "/v1/controls",
    response_model=List[ControlResponse],
    dependencies=[Depends(http_bearer)],
)
async def list_controls(
    framework_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    # tenant_ctx = Depends(tenant_context),  # wire the actual tenant dependency here
    # _scope = Depends(lambda: require_scope("controls:read")),  # wire the actual scope check here
):
    """
    List controls. Optional framework_id filters results.
    RLS must enforce tenant isolation; do NOT filter by tenant_id in Python.
    """
    stmt = select(Control)
    if framework_id:
        stmt = stmt.where(Control.framework_id == framework_id)

    result = await db.execute(stmt)
    controls = result.scalars().all()
    return controls


@router.get(
    "/v1/controls/{control_id}",
    response_model=ControlResponse,
    dependencies=[Depends(http_bearer)],
)
async def get_control(
    control_id: UUID,
    db: AsyncSession = Depends(get_db),
    # tenant_ctx = Depends(tenant_context),  # wire the actual tenant dependency here
    # _scope = Depends(lambda: require_scope("controls:read")),  # wire the actual scope check here
):
    """
    Fetch a single control by id. Returns 404 if not found (including cross-tenant).
    """
    stmt = select(Control).where(Control.control_id == control_id)
    result = await db.execute(stmt)
    control = result.scalar_one_or_none()
    if control is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Control not found.")
    return control
