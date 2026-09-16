import json
import logging
from collections.abc import Callable
from pathlib import Path
from typing import Any
from uuid import UUID

import anyio
from fastapi import HTTPException, Request, status

logger = logging.getLogger(__name__)


def require_scope(*required_scopes: str) -> Callable:
    """FastAPI dependency factory to enforce required permissions/scopes."""

    async def _check_scopes(request: Request) -> None:
        user_scopes = set(getattr(request.state, "scopes", []))
        required_set = set(required_scopes)

        if not required_set.issubset(user_scopes):
            missing = required_set - user_scopes
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: Missing required scope(s): {', '.join(sorted(missing))}",
            )

    return _check_scopes


def get_tenant_and_user(request: Request) -> tuple[UUID, UUID]:
    """Retrieves authenticated context set on request.state by KeycloakAuthMiddleware."""
    tenant_id = getattr(request.state, "tenant_id", None)
    user_id = getattr(request.state, "user_id", None)

    if not tenant_id or not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication context.",
        )
    return tenant_id, user_id


def load_json_file(file_path: Path) -> dict[str, Any]:
    """Helper method to read a JSON file synchronously within an isolated worker thread."""
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


async def load_seed_files(
    pattern: str,
    exclude_pattern: str | None = None,
) -> dict[str, dict]:
    """To load the files automatically into the database tables for the created tenant"""
    seeds_dir = Path(__file__).resolve().parents[1] / "seeds"
    seed_map = {}

    for json_file in seeds_dir.glob(pattern):
        if exclude_pattern and json_file.match(exclude_pattern):
            continue

        try:
            file_data = await anyio.to_thread.run_sync(load_json_file, json_file)
            json_code = file_data.get("metadata", {}).get("code")

            if json_code:
                seed_map[json_code] = file_data

        except (OSError, json.JSONDecodeError) as e:
            logger.warning(f"Failed to load or parse seed file {json_file}: {e}")

    return seed_map
