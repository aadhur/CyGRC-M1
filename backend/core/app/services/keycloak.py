import httpx
from app.core.config import settings
from fastapi import HTTPException, status


async def provision_user_in_keycloak(
    email: str, password: str, tenant_id: str, role: str = "user"
) -> str:
    """
    Handles all administrative API requests to Keycloak.
    Creates the user, sets their password permanently, and grabs their token.
    """
    async with httpx.AsyncClient() as client:
        # Get Master Admin Token
        try:
            admin_token_resp = await client.post(
                f"{settings.KEYCLOAK_BASE_URL}/realms/master/protocol/openid-connect/token",
                data={
                    "client_id": "admin-cli",
                    "username": settings.KEYCLOAK_ADMIN_USER,
                    "password": settings.KEYCLOAK_ADMIN_PASSWORD,
                    "grant_type": "password",
                },
            )
            admin_token_resp.raise_for_status()
            admin_token = admin_token_resp.json()["access_token"]
        except (httpx.HTTPError, KeyError, ValueError) as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Keycloak Admin Authentication failed: {e!s}",
            ) from e

        # Register the user with attributes
        headers = {
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json",
        }

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

        try:
            create_resp = await client.post(
                f"{settings.KEYCLOAK_BASE_URL}/admin/realms/{settings.KEYCLOAK_REALM}/users",
                json=user_payload,
                headers=headers,
            )
            if create_resp.status_code == 409:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="This email is already registered in Keycloak.",
                )
            create_resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create user inside Keycloak: {e.response.text}",
            ) from e

        # Get newly created Keycloak User ID and Role details
        try:
            # Get User ID
            get_user_resp = await client.get(
                f"{settings.KEYCLOAK_BASE_URL}/admin/realms/{settings.KEYCLOAK_REALM}/users",
                params={"email": email, "exact": "true"},
                headers=headers,
            )
            get_user_resp.raise_for_status()
            kc_user_id = get_user_resp.json()[0]["id"]

            # Get Role details for the requested role ('admin' or 'user')
            role_resp = await client.get(
                f"{settings.KEYCLOAK_BASE_URL}/admin/realms/{settings.KEYCLOAK_REALM}/roles/{role}",
                headers=headers,
            )
            role_resp.raise_for_status()
            role_data = role_resp.json()

            # Assign Role to User
            assign_role_resp = await client.post(
                f"{settings.KEYCLOAK_BASE_URL}/admin/realms/{settings.KEYCLOAK_REALM}/users/{kc_user_id}/role-mappings/realm",
                json=[{"id": role_data["id"], "name": role_data["name"]}],
                headers=headers,
            )
            assign_role_resp.raise_for_status()

        except (httpx.HTTPError, KeyError, IndexError, ValueError) as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to map role '{role}' in Keycloak: {e!s}",
            ) from e

        # D. Retrieve User JWT with standard scopes
        try:
            login_resp = await client.post(
                f"{settings.KEYCLOAK_BASE_URL}/realms/{settings.KEYCLOAK_REALM}/protocol/openid-connect/token",
                data={
                    "client_id": settings.KEYCLOAK_CLIENT_ID,
                    "username": email,
                    "password": password,
                    "grant_type": "password",
                    "scope": "openid auditlog:read controls:read evidence:write",
                },
            )
            login_resp.raise_for_status()
            return login_resp.json()["access_token"]
        except (httpx.HTTPError, KeyError, ValueError) as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to retrieve user JWT token from Keycloak: {e!s}",
            ) from e
