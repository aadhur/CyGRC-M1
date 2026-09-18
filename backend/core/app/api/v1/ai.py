import hashlib
import secrets

import httpx
from app.api.deps import get_tenant_and_user, require_scope
from app.db.models import AIDraft, Control, Risk
from app.db.session import get_db
from app.schemas.ai import ApproveRequest, DraftRequest, DraftResponse
from app.services.slm_client import generate
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer
from sqlalchemy import select
from uuid6 import uuid7

router = APIRouter()


@router.post(
    "/draft/control",
    response_model=DraftResponse,
    dependencies=[
        Depends(require_scope("ai:draft")),
        Depends(HTTPBearer()),
    ],
)
async def draft_control(
    payload: DraftRequest,
    db=Depends(get_db),  # noqa: B008
    tenant_user=Depends(get_tenant_and_user),  # noqa: B008
):
    tenant_id, user_id = tenant_user

    stmt = select(Control).where(
        Control.control_id == payload.control_id,
        Control.tenant_id == tenant_id,
    )

    result = await db.execute(stmt)
    control = result.scalar_one_or_none()

    if not control:
        raise HTTPException(
            status_code=404,
            detail="Control not found.",
        )

    prompt = (
        "Draft an improved compliance control description based only on "
        "the existing control information.\n\n"
        f"Code: {control.code}\n"
        f"Title: {control.title}\n"
        f"Existing Description: {control.description or 'None'}\n\n"
        "Return only the proposed description."
    )

    try:
        output = await generate(prompt)
    except (httpx.HTTPError, KeyError, ValueError):
        raise HTTPException(
            status_code=502,
            detail="Could not reach the SLM or got an unexpected response.",
        )

    draft = AIDraft(
        draft_id=uuid7(),
        tenant_id=tenant_id,
        control_id=control.control_id,
        risk_id=None,
        prompt_hash=hashlib.sha256(prompt.encode()).hexdigest(),
        output=output,
        model="Qwen2.5-7B-Instruct",
        review_token=secrets.token_urlsafe(32),
        requested_by=user_id,
    )

    db.add(draft)
    await db.commit()

    return DraftResponse(
        draft_id=draft.draft_id,
        review_token=draft.review_token,
        output=draft.output,
        model=draft.model,
    )


@router.post(
    "/draft/risk",
    response_model=DraftResponse,
    dependencies=[
        Depends(require_scope("ai:draft")),
        Depends(HTTPBearer()),
    ],
)
async def draft_risk_description(
    payload: DraftRequest,
    db=Depends(get_db),  # noqa: B008
    tenant_user=Depends(get_tenant_and_user),  # noqa: B008
):
    tenant_id, user_id = tenant_user

    stmt = select(Risk).where(
        Risk.risk_id == payload.risk_id,
        Risk.tenant_id == tenant_id,
    )

    result = await db.execute(stmt)
    risk = result.scalar_one_or_none()

    if not risk:
        raise HTTPException(
            status_code=404,
            detail="Risk not found.",
        )

    prompt = (
        "Rewrite the following risk description more clearly "
        "based only on the provided risk information.\n\n"
        f"Title: {risk.title}\n"
        f"Current Description: {risk.description or 'None'}\n"
        f"Likelihood: {risk.likelihood}\n"
        f"Impact: {risk.impact}\n"
        f"Treatment: {risk.treatment.value}\n"
        f"Treatment Plan: {risk.treatment_plan or 'None'}\n\n"
        "Return only the proposed risk description."
    )

    try:
        output = await generate(prompt)
    except (httpx.HTTPError, KeyError, ValueError):
        raise HTTPException(
            status_code=502,
            detail="Could not reach the SLM or got an unexpected response.",
        )

    draft = AIDraft(
        draft_id=uuid7(),
        tenant_id=tenant_id,
        control_id=None,
        risk_id=risk.risk_id,
        prompt_hash=hashlib.sha256(prompt.encode()).hexdigest(),
        output=output,
        model="Qwen2.5-7B-Instruct",
        review_token=secrets.token_urlsafe(32),
        requested_by=user_id,
    )

    db.add(draft)
    await db.commit()

    return DraftResponse(
        draft_id=draft.draft_id,
        review_token=draft.review_token,
        output=draft.output,
        model=draft.model,
    )


@router.post(
    "/draft/{token}/approve",
    dependencies=[
        Depends(require_scope("ai:approve")),
        Depends(HTTPBearer()),
    ],
)
async def approve_draft(
    token: str,
    payload: ApproveRequest,
    db=Depends(get_db),  # noqa: B008
    tenant_user=Depends(get_tenant_and_user),  # noqa: B008
):
    _, user_id = tenant_user

    result = await db.execute(
        select(AIDraft).where(
            AIDraft.review_token == token,
        )
    )

    draft = result.scalar_one_or_none()

    if draft is None:
        raise HTTPException(
            status_code=404,
            detail="Draft not found.",
        )

    if draft.status != "PENDING":
        raise HTTPException(
            status_code=409,
            detail=f"Draft is already {draft.status}, cannot approve.",
        )

    if draft.control_id is not None and draft.risk_id is None:
        control = await db.get(Control, draft.control_id)

        if control is None:
            raise HTTPException(
                status_code=404,
                detail="The control associated with this draft no longer exists.",
            )

        control.description = payload.edited_output

        resource_type = "control"
        resource_id = draft.control_id

    elif draft.risk_id is not None and draft.control_id is None:
        risk = await db.get(Risk, draft.risk_id)

        if risk is None:
            raise HTTPException(
                status_code=404,
                detail="The risk associated with this draft no longer exists.",
            )

        risk.description = payload.edited_output

        resource_type = "risk"
        resource_id = draft.risk_id

    else:
        raise HTTPException(
            status_code=500,
            detail="Invalid AI draft: draft must reference exactly one resource.",
        )

    draft.status = "APPROVED"
    draft.reviewed_by = user_id

    await db.commit()

    return {
        "message": "Draft approved and applied.",
        "type": resource_type,
        "resource_id": resource_id,
        "draft_id": draft.draft_id,
    }
