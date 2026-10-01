import httpx
from app.core.config import settings
from fastapi import HTTPException, status


async def _get_admin_token(client: httpx.AsyncClient) -> str:
    """Helper to authenticate and fetch the Keycloak master admin token."""
    try:
        resp = await client.post(
            f"{settings.KEYCLOAK_BASE_URL}/realms/master/protocol/openid-connect/token",
            data={
                "client_id": "admin-cli",
                "username": settings.KEYCLOAK_ADMIN_USER,
                "password": settings.KEYCLOAK_ADMIN_PASSWORD,
                "grant_type": "password",
            },
        )
        resp.raise_for_status()
        return resp.json()["access_token"]
    except (httpx.HTTPError, KeyError, ValueError) as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Keycloak Admin Authentication failed: {e!s}",
        ) from e


async def provision_user_in_keycloak(
    email: str, password: str, tenant_id: str, role: str = "TENANT_ADMIN"
) -> tuple[str, str]:
    """
    Creates a user in Keycloak, assigns their role, and returns (access_token, kc_user_id).
    """
    async with httpx.AsyncClient() as client:
        admin_token = await _get_admin_token(client)
        headers = {
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json",
        }

        # 1. Register User
        user_payload = {
            "username": email,
            "email": email,
            "enabled": True,
            "emailVerified": True,
            "requiredActions": [],
            "attributes": {"tenant_id": [tenant_id]},
            "credentials": [
                {"type": "password", "value": password, "temporary": False}
            ],
        }

        create_resp = await client.post(
            f"{settings.KEYCLOAK_BASE_URL}/admin/realms/{settings.KEYCLOAK_REALM}/users",
            json=user_payload,
            headers=headers,
        )

        if create_resp.status_code == status.HTTP_409_CONFLICT:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This email is already registered in Keycloak.",
            )

        try:
            create_resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create user inside Keycloak: {e.response.text}",
            ) from e

        # 2. Assign Realm Role
        try:
            location = create_resp.headers.get("Location")
            if not location:
                raise ValueError("Keycloak did not return created user location.")
            kc_user_id = location.rstrip("/").split("/")[-1]

            role_resp = await client.get(
                f"{settings.KEYCLOAK_BASE_URL}/admin/realms/{settings.KEYCLOAK_REALM}/roles/{role}",
                headers=headers,
            )
            role_resp.raise_for_status()
            role_data = role_resp.json()

            assign_resp = await client.post(
                f"{settings.KEYCLOAK_BASE_URL}/admin/realms/{settings.KEYCLOAK_REALM}/users/{kc_user_id}/role-mappings/realm",
                json=[{"id": role_data["id"], "name": role_data["name"]}],
                headers=headers,
            )
            assign_resp.raise_for_status()
        except (httpx.HTTPError, KeyError, ValueError) as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to map role '{role}' in Keycloak: {e!s}",
            ) from e

        # 3. Retrieve User JWT
        try:
            login_resp = await client.post(
                f"{settings.KEYCLOAK_BASE_URL}/realms/{settings.KEYCLOAK_REALM}/protocol/openid-connect/token",
                data={
                    "client_id": settings.KEYCLOAK_CLIENT_ID,
                    "username": email,
                    "password": password,
                    "grant_type": "password",
                    "scope": "openid",
                },
            )
            login_resp.raise_for_status()
            token_json = login_resp.json()
            access_token = token_json["access_token"]
            refresh_token = token_json.get("refresh_token")
            return access_token, refresh_token, kc_user_id
        except (httpx.HTTPError, KeyError, ValueError) as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to retrieve user JWT token from Keycloak: {e!s}",
            ) from e


async def delete_keycloak_user(kc_user_id: str) -> None:
    """Deletes a user from Keycloak by their Keycloak User ID."""
    async with httpx.AsyncClient() as client:
        admin_token = await _get_admin_token(client)
        headers = {"Authorization": f"Bearer {admin_token}"}

        try:
            delete_resp = await client.delete(
                f"{settings.KEYCLOAK_BASE_URL}/admin/realms/{settings.KEYCLOAK_REALM}/users/{kc_user_id}",
                headers=headers,
            )

            if delete_resp.status_code == status.HTTP_404_NOT_FOUND:
                return  # Idempotent return

            delete_resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete user in Keycloak: {e.response.text}",
            ) from e
        except httpx.HTTPError as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Network error while communicating with Keycloak: {e!s}",
            ) from e
