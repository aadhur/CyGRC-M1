from uuid import uuid4

import pytest

PROTECTED_ENDPOINTS = [
    "/v1/controls",
    "/v1/risks",
    "/v1/audits",
    "/v1/users",
    "/v1/dpdp/breach-clock",
]


@pytest.mark.asyncio
@pytest.mark.parametrize("endpoint", PROTECTED_ENDPOINTS)
async def test_missing_authorization_header(client, endpoint):
    response = await client.get(endpoint)

    assert response.status_code == 401


@pytest.mark.asyncio
@pytest.mark.parametrize("endpoint", PROTECTED_ENDPOINTS)
async def test_basic_auth_rejected(client, endpoint):
    response = await client.get(
        endpoint,
        headers={"Authorization": "Basic dXNlcjpwYXNz"},
    )

    assert response.status_code == 401


@pytest.mark.asyncio
@pytest.mark.parametrize("endpoint", PROTECTED_ENDPOINTS)
async def test_malformed_bearer_token_rejected(client, endpoint):
    response = await client.get(
        endpoint,
        headers={"Authorization": "Bearer malformed.jwt.token"},
    )

    assert response.status_code == 401


@pytest.mark.asyncio
@pytest.mark.parametrize("endpoint", PROTECTED_ENDPOINTS)
async def test_missing_tenant_id_rejected(
    client,
    make_auth_token,
    endpoint,
):
    token = make_auth_token(
        tenant_id=uuid4(),
        omit_tenant_id=True,
    )

    response = await client.get(
        endpoint,
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == (
        "Invalid JWT payload. Attribute 'tenant_id' is missing."
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("endpoint", PROTECTED_ENDPOINTS)
async def test_missing_sub_rejected(
    client,
    make_auth_token,
    endpoint,
):
    token = make_auth_token(
        tenant_id=uuid4(),
        omit_sub=True,
    )

    response = await client.get(
        endpoint,
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == (
        "Invalid JWT payload. Attribute 'sub' is missing."
    )
