import httpx
from app.core.config import settings


async def get_endpoint_url() -> str:
    return settings.SLM_ENDPOINT_URL


async def generate(prompt: str) -> str:
    endpoint_url = await get_endpoint_url()

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{endpoint_url.rstrip('/')}/generate",
            json={"prompt": prompt},
        )
        resp.raise_for_status()

        return resp.json()["output"]
