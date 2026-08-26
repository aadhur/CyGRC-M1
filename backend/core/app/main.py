from app.api.v1.onboard import router as onboard_router
from fastapi import FastAPI

app = FastAPI(title="CyGRC Core API", version="1.0.0", docs_url="/docs")

# Connect the onboarding router into the main app
app.include_router(onboard_router)


@app.get("/healthz")
def health_check():
    return {"status": "healthy"}
