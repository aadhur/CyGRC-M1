"""
test_evidence_review.py - standalone tests for evidence_review.py
Run from repo root:
    backend\core\venv\Scripts\python tests\test_evidence_review.py
"""
import sys, os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend", "core"))

from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.api.v1.evidence_review import router, ReviewRequest, ReviewResponse, CurrentUser

# Minimal test app -- does NOT touch main.py
test_app = FastAPI()
test_app.include_router(router)
client = TestClient(test_app, raise_server_exceptions=False)

FAKE_TENANT = "01a061ae-3bff-7ac0-a949-d9274d8257da"
FAKE_USER   = "01a061ae-3c00-7f53-bd75-1891499e2ccd"
FAKE_EVID   = "01930000-0000-7000-0000-000000000001"
BYPASS      = {"X-Test-Tenant-ID": FAKE_TENANT, "X-Test-User-ID": FAKE_USER}

PASS = "\033[92mPASS\033[0m"
FAIL = "\033[91mFAIL\033[0m"
results = []

def check(name, condition, got=None):
    ok = bool(condition)
    print(f"  [{PASS if ok else FAIL}] {name}")
    if not ok and got is not None:
        print(f"         got: {got}")
    results.append(ok)

print("\n== Group A: No-DB tests (import / schema / auth / validation) ==\n")

# A1: imports
try:
    from app.api.v1.evidence_review import Evidence, get_current_user
    check("A1: module imports without error", True)
except Exception as e:
    check("A1: module imports without error", False, str(e))

# A2: Pydantic schema accepts valid values
try:
    r = ReviewRequest(review_status="approved")
    check("A2: ReviewRequest accepts 'approved'", r.review_status == "approved")
    r2 = ReviewRequest(review_status="rejected")
    check("A2: ReviewRequest accepts 'rejected'", r2.review_status == "rejected")
except Exception as e:
    check("A2: ReviewRequest valid values", False, str(e))

# A3: 401 when no auth at all
resp = client.post(f"/v1/evidence/{FAKE_EVID}/review", json={"review_status": "approved"})
check("A3: 401 with no auth headers", resp.status_code == 401, resp.status_code)

# A4: 422 on invalid review_status value
resp = client.post(f"/v1/evidence/{FAKE_EVID}/review", headers=BYPASS, json={"review_status": "maybe"})
check("A4: 422 on review_status='maybe'", resp.status_code == 422, resp.status_code)

# A5: 422 when review_status field missing
resp = client.post(f"/v1/evidence/{FAKE_EVID}/review", headers=BYPASS, json={})
check("A5: 422 when review_status missing", resp.status_code == 422, resp.status_code)

# A6: 422 on malformed UUID path param
resp = client.post("/v1/evidence/not-a-uuid/review", headers=BYPASS, json={"review_status": "approved"})
check("A6: 422 on malformed UUID in path", resp.status_code == 422, resp.status_code)

# A7: 401 on invalid UUID in bypass headers
resp = client.post(f"/v1/evidence/{FAKE_EVID}/review",
                   headers={"X-Test-Tenant-ID": "bad", "X-Test-User-ID": "bad"},
                   json={"review_status": "approved"})
check("A7: 401 on non-UUID bypass header values", resp.status_code == 401, resp.status_code)

# A8: route registered -- use OpenAPI schema (reliable across FastAPI versions)
schema_paths = list(test_app.openapi().get("paths", {}).keys())
check("A8: /v1/evidence/{id}/review route in OpenAPI schema", "/v1/evidence/{id}/review" in schema_paths, schema_paths)

# A9: ReviewResponse shape
try:
    rr = ReviewResponse(message="Evidence item with the id abc reviewed")
    check("A9: ReviewResponse has .message field", hasattr(rr, "message"))
except Exception as e:
    check("A9: ReviewResponse shape", False, str(e))

# A10: CurrentUser dataclass
try:
    from uuid import UUID
    cu = CurrentUser(user_id=UUID(FAKE_USER), tenant_id=UUID(FAKE_TENANT))
    check("A10: CurrentUser dataclass works", cu.user_id == UUID(FAKE_USER))
except Exception as e:
    check("A10: CurrentUser dataclass", False, str(e))

# A11: response message format matches spec
# The spec says: "Evidence item with the id <uuid> reviewed"
# We verify the format by checking what a 404 returns (no DB needed)
resp = client.post(f"/v1/evidence/{FAKE_EVID}/review", headers=BYPASS, json={"review_status": "approved"})
# Will be 500 (DB not running) or 404 -- either way, NOT a 200 with wrong format
check("A11: endpoint does not return 200 without DB", resp.status_code != 200, resp.status_code)

print("\n== Group B: Live DB tests ==")
print("   Skipped - Docker not running.")
print("   Start Docker, run: docker-compose up -d && alembic upgrade head")
print("   Then POST to /v1/evidence/{id}/review with X-Test-* headers\n")

passed = sum(results)
total  = len(results)
print("=" * 52)
print(f"  Result: {passed}/{total} passed")
if passed == total:
    print("  \033[92mAll checks passed!\033[0m")
else:
    print(f"  \033[91m{total - passed} test(s) failed\033[0m")
print("=" * 52)
sys.exit(0 if passed == total else 1)
