import pytest


@pytest.mark.asyncio
async def test_sliding_window_rate_limiting(client, setup_valkey_mock):
    endpoint = "/healthz"

    # 1. Send 120 successive HTTP requests (the allowed window)
    for _ in range(120):
        response = await client.get(endpoint)
        # Ensure we aren't getting blocked early
        assert response.status_code != 429

    # 2. Send request #121 within the same window
    response_121 = await client.get(endpoint)

    # 3. Expect 429 Too Many Requests and the exact error string
    assert response_121.status_code == 429
    assert response_121.json()["detail"] == "Rate limit exceeded. Try again shortly."
