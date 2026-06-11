# Python FastAPI Integration

Use `packages/aegisops-python` to monitor FastAPI services with request metrics, slow-request metrics, error logs, and exception telemetry.

## 1. Create Project

Open `/connect-project`, choose a project type, and create the project.

## 2. Create Service

Add a service with language `Python FastAPI`. Use the service name exactly as it will appear in `AEGISOPS_SERVICE_NAME`.

## 3. Generate API Key

Generate a service API key in the wizard. SDK requests use:

```txt
Authorization: Bearer YOUR_API_KEY
```

## 4. Install SDK

```bash
pip install -e packages/aegisops-python
```

For a real app outside this repository, point the editable install at the local package path until the SDK is published.

## 5. Add Env Variables

```bash
AEGISOPS_ENABLED=true
AEGISOPS_API_URL=http://localhost:8080
AEGISOPS_API_KEY=YOUR_API_KEY
AEGISOPS_PROJECT_KEY=loan-tracker
AEGISOPS_SERVICE_NAME=loan-tracker-fastapi
AEGISOPS_ENVIRONMENT=production
AEGISOPS_SLOW_REQUEST_THRESHOLD_MS=1000
AEGISOPS_FLUSH_INTERVAL_MS=5000
AEGISOPS_BATCH_SIZE=20
AEGISOPS_DEBUG=false
```

## 6. Add Middleware

```python
from fastapi import FastAPI
from aegisops import add_aegisops_middleware

app = FastAPI()
add_aegisops_middleware(app)

@app.get("/health")
async def health():
    return {"ok": True}
```

`AegisOpsMiddleware` is also exported for direct ASGI usage.

## 7. Run App

```bash
uvicorn app.main:app --host 0.0.0.0 --port 7002
```

Or run the included example:

```bash
cd examples/fastapi-service
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
set -a && . ./.env && set +a
uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-7002}"
```

## 8. Hit Routes

```bash
curl http://localhost:7002/health
curl http://localhost:7002/api/orders
curl -X POST http://localhost:7002/api/orders -H "Content-Type: application/json" -d '{"sku":"premium-plan","quantity":2}'
curl http://localhost:7002/api/slow
curl http://localhost:7002/api/error
curl http://localhost:7002/api/random
```

## 9. Verify

Refresh the service in Connect Project. Then open Logs and Metrics and check for:

```txt
http_requests_total
http_request_duration_ms
http_errors_total
http_4xx_total
http_5xx_total
slow_requests_total
exceptions_total
```

## 10. Troubleshooting

- `not_connected`: hit a real app route after generating the service API key.
- Missing metrics: wait for the flush interval or lower `AEGISOPS_BATCH_SIZE`.
- 401/403: verify `AEGISOPS_API_KEY`, `AEGISOPS_PROJECT_KEY`, and `AEGISOPS_SERVICE_NAME`.
- App should keep running if AegisOps is down; telemetry is retried and dropped safely.
- Health routes are ignored by default: `/health`, `/metrics`, `/favicon.ico`.
