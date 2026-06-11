# AegisOps Python SDK

FastAPI and generic Python telemetry SDK for AegisOps.

```bash
pip install -e packages/aegisops-python
```

```python
from fastapi import FastAPI
from aegisops import AegisOpsMiddleware, add_aegisops_middleware

app = FastAPI()
add_aegisops_middleware(app)
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

The SDK batches metrics, retries failed sends, adds request/trace IDs, and never raises telemetry failures into the monitored app.

Run the example service:

```bash
cd examples/fastapi-service
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 7002
```
