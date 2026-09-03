from app.api.v1.evidence_review import router as evidence_review_router
from app.api.v1.onboard import router as onboard_router
from fastapi import FastAPI

app = FastAPI(title="CyGRC Core API", version="1.0.0", docs_url="/docs")

# Connect the onboarding router into the main app
app.include_router(onboard_router)

# TEMPORARY (B5 evidence-review): removed when merged into final evidence.py
app.include_router(evidence_review_router)


@app.get("/healthz")
def health_check():
    return {"status": "healthy"}
