from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Control, ControlStatusHistory
from app.services._draft_calculate_status import (
    calculate_control_status,
    control_status_to_history_string,
)


async def recalculate_tenant_controls(
    db: AsyncSession,
    tenant_id: UUID,
    control_id: UUID | None = None,
) -> list[Control]:
    """
    Recalculate compliance status for one or all controls in the current tenant.

    RLS is responsible for tenant isolation. No tenant_id filter is added to
    the control query.
    """
    if control_id is not None:
        stmt = select(Control).where(Control.control_id == control_id)
    else:
        stmt = select(Control)

    result = await db.execute(stmt)
    controls = list(result.scalars().all())

    if control_id is not None and not controls:
        raise ValueError(f"Control with ID {control_id} not found")

    for control in controls:
        old_status, new_status = await calculate_control_status(
            db,
            tenant_id,
            control.control_id,
        )

        if old_status != new_status:
            control.status = new_status

            history = ControlStatusHistory(
                history_id=uuid4(),
                control_id=control.control_id,
                tenant_id=tenant_id,
                old_status=control_status_to_history_string(old_status),
                new_status=control_status_to_history_string(new_status),
            )
            db.add(history)

    await db.commit()

    return controls
