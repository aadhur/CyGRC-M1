"""
Compliance Engine - Control Status Calculation
Issue #B6 - Vikram's Task (Due: Sept 15, 2026)

This module calculates the compliance status of controls based on their
evidence requirements and collected evidence.

Author: Vikram Singh
Team: GRC 2
"""

from datetime import datetime, timezone
from uuid import UUID

from app.db.models import (
    Control,
    ControlStatus,
    Evidence,
    EvidenceRequirement,
    Finding,
    FindingStatusEnum,
)
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession


async def calculate_control_status(
    db: AsyncSession,
    tenant_id: UUID,
    control_id: UUID,
) -> tuple[ControlStatus, ControlStatus]:
    """
    Calculate the compliance status of a single control based on evidence.

    This function performs READ-ONLY operations. The caller (Manish's
    recalculate_tenant_controls) is responsible for persisting status
    changes to control.status and control_status_history.

    Status Determination Logic (in priority order):
    ------------------------------------------------
    1. IN_REMEDIATION - If an Open or InRemediation finding exists (overrides all)
    2. NOT_ASSESSED   - No evidence requirements defined for the control
    3. FAILING        - At least one requirement has no approved evidence
    4. STALE          - At least one requirement has evidence older than cadence_days
    5. PASSING        - All requirements have fresh approved evidence

    Critical Rules:
    ---------------
    - Only evidence with review_status='APPROVED' (exact string) counts
    - Pending or rejected evidence is COMPLETELY IGNORED, even if newer
    - Staleness check uses STRICT inequality: age_days > cadence_days
    - Findings table check is wrapped in try/except (table may be empty)

    Args:
        db: Active async database session
        tenant_id: Tenant UUID (for context; RLS filtering is automatic)
        control_id: UUID of the control to evaluate

    Returns:
        Tuple of (old_status, new_status) as ControlStatus enum members

    Raises:
        ValueError: If the control_id does not exist in the database

    Example:
        >>> old, new = await calculate_control_status(db, tenant_id, control_id)
        >>> if old != new:
        ...     print(f"Status changed: {old} -> {new}")
    """

    # =========================================================================
    # STEP 1: Load the control and capture its current status
    # =========================================================================
    result = await db.execute(select(Control).where(Control.control_id == control_id))
    control = result.scalar_one_or_none()

    if control is None:
        raise ValueError(f"Control with ID {control_id} not found")

    old_status = control.status

    # =========================================================================
    # STEP 2: Override Check - Open/InRemediation Findings
    # This takes priority over ALL other status calculations
    # =========================================================================
    try:
        finding_result = await db.execute(
            select(Finding)
            .where(
                Finding.control_id == control_id,
                Finding.status.in_(
                    [
                        FindingStatusEnum.OPEN,
                        FindingStatusEnum.IN_REMEDIATION,
                    ]
                ),
            )
            .limit(1)  # We only need to know if ANY exists
        )

        if finding_result.first() is not None:
            # Finding exists - status is IN_REMEDIATION regardless of evidence
            return (old_status, ControlStatus.IN_REMEDIATION)

    except SQLAlchemyError:
        # Findings table might not exist yet or could be empty
        # Gracefully skip this check and fall through to evidence-based logic
        await db.rollback()  # Critical: prevents transaction poisoning

    # =========================================================================
    # STEP 3: Load all evidence requirements for this control
    # =========================================================================
    req_result = await db.execute(
        select(EvidenceRequirement).where(EvidenceRequirement.control_id == control_id)
    )
    requirements = req_result.scalars().all()

    # -------------------------------------------------------------------------
    # Rule 1: No requirements defined = NOT_ASSESSED
    # -------------------------------------------------------------------------
    if not requirements:
        return (old_status, ControlStatus.NOT_ASSESSED)

    # =========================================================================
    # STEP 4: Evaluate each requirement for evidence freshness
    # =========================================================================
    now = datetime.now(timezone.utc)
    has_missing = False  # At least one requirement has NO approved evidence
    has_stale = False  # At least one requirement has STALE approved evidence

    for req in requirements:
        # ---------------------------------------------------------------------
        # Find the most recent APPROVED evidence for this requirement
        # ---------------------------------------------------------------------
        # CRITICAL: review_status must be the STRING "APPROVED"
        # The WHERE clause filters BEFORE ordering, so pending/rejected
        # evidence is ignored even if it's newer than approved evidence
        evidence_result = await db.execute(
            select(Evidence)
            .where(
                Evidence.control_id == control_id,
                Evidence.requirement_id == req.requirement_id,
                Evidence.review_status == "APPROVED",  # Must be exact string
            )
            .order_by(Evidence.collected_at.desc())
            .limit(1)
        )
        latest_evidence = evidence_result.scalar_one_or_none()

        # ---------------------------------------------------------------------
        # Check 1: Does approved evidence exist?
        # ---------------------------------------------------------------------
        if latest_evidence is None:
            # No approved evidence found for this requirement
            # This could mean:
            # - No evidence uploaded at all
            # - Only pending evidence exists
            # - Only rejected evidence exists
            has_missing = True
            continue  # Keep checking other requirements

        # ---------------------------------------------------------------------
        # Check 2: Is the evidence stale?
        # ---------------------------------------------------------------------
        collected_at = latest_evidence.collected_at

        # Defensive: Handle naive datetime (shouldn't happen per model definition)
        if collected_at.tzinfo is None:
            collected_at = collected_at.replace(tzinfo=timezone.utc)

        # Only check staleness if cadence_days is defined
        if req.cadence_days is not None:
            age_days = (now - collected_at).days

            # CRITICAL: Use strict inequality (>), not (>=)
            # Evidence collected exactly cadence_days ago is still fresh
            if age_days > req.cadence_days:
                has_stale = True

    # =========================================================================
    # STEP 5: Determine final status based on flags
    # Priority order: FAILING > STALE > PASSING
    # =========================================================================
    if has_missing:
        # At least one requirement has no approved evidence
        new_status = ControlStatus.FAILING
    elif has_stale:
        # All requirements have approved evidence, but at least one is stale
        new_status = ControlStatus.STALE
    else:
        # All requirements have fresh approved evidence
        new_status = ControlStatus.PASSING

    return (old_status, new_status)


def control_status_to_history_string(status: ControlStatus) -> str:
    """
    Convert ControlStatus enum to control_status_history table string format.

    The control_status_history table uses title-case strings like "Passing"
    and "In Remediation", while the Control.status field uses the ControlStatus
    enum with values like PASSING and IN_REMEDIATION.

    This helper ensures consistent string format when writing to the history table.

    Args:
        status: ControlStatus enum member

    Returns:
        Title-case string suitable for control_status_history table

    Example:
        >>> control_status_to_history_string(ControlStatus.PASSING)
        'Passing'
        >>> control_status_to_history_string(ControlStatus.IN_REMEDIATION)
        'In Remediation'

    Note:
        This is used by Manish's recalculate_tenant_controls() function
        when inserting rows into control_status_history.
    """
    mapping = {
        ControlStatus.NOT_ASSESSED: "Not Assessed",
        ControlStatus.PASSING: "Passing",
        ControlStatus.FAILING: "Failing",
        ControlStatus.STALE: "Stale",
        ControlStatus.IN_REMEDIATION: "In Remediation",
    }
    return mapping[status]
