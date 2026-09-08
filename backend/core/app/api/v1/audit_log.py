from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer

router = APIRouter()

security = HTTPBearer()
credentials_dependency = Depends(security)


@router.get("/")
def get_audit_logs(request: Request, credentials=credentials_dependency):
    scopes = request.state.scopes

    if "auditlog:read" not in scopes:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Missing required scope: auditlog:read",
        )

    return {
        "audit_logs": [
            {
                "log_id": "sample_log_id",
                "actor_id": "sample_actor_id",
                "action": "sample_action",
                "target": "sample_target",
                "request_id": "sample_request_id",
                "ip_address": "sample_ip_address",
                "user_agent": "sample_user_agent",
                "created_at": "sample_created_at",
            }
        ]
    }
