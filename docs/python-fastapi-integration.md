# Python FastAPI Integration

Use the local SDK package from `packages/aegisops-python`.

```bash
pip install -e packages/aegisops-python
```

Environment:

```bash
AEGISOPS_ENABLED=true
AEGISOPS_API_URL=http://localhost:8080
AEGISOPS_API_KEY=YOUR_API_KEY
AEGISOPS_PROJECT_KEY=loan-tracker
AEGISOPS_SERVICE_NAME=loan-tracker-api
AEGISOPS_ENVIRONMENT=production
```

Middleware:

```python
from fastapi import FastAPI
from aegisops import add_aegisops_middleware

app = FastAPI()
add_aegisops_middleware(app)

@app.get("/health")
async def health():
    return {"ok": True}
```

The SDK batches metrics, retries failed sends, adds `x-request-id` and `x-trace-id`, emits request/error/slow-request metrics, and drops telemetry safely if AegisOps is unavailable.
