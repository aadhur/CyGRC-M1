from fastapi import HTTPException, Request, status


def require_scope(scope: str):
    def _check(request: Request):
        user_scopes = getattr(request.state, "scopes", [])
        if scope not in user_scopes:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: Required scope missing: {scope}",
            )

    return _check
