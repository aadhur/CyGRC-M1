from uuid import UUID

# Note: Adjust these imports based on your exact project structure
from app.api.dependencies import get_db, get_tenant_and_user
from app.db import models
from app.schemas import audits as schemas
from fastapi import APIRouter, Depends, HTTPException, status
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
