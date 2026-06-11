# AegisOps FastAPI Example

Small FastAPI app wired to `packages/aegisops-python`.

## Run

1. Start AegisOps from the repository root.
2. Open `/connect-project`, create a project and a Python FastAPI service.
3. Generate the service API key.
4. Copy `.env.example` to `.env` and set `AEGISOPS_API_KEY`.
5. Install and start:

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
set -a && . ./.env && set +a
uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-7002}"
```

6. Hit routes:

```bash
curl http://localhost:7002/health
curl http://localhost:7002/api/orders
curl -X POST http://localhost:7002/api/orders -H "Content-Type: application/json" -d '{"sku":"premium-plan","quantity":2}'
curl http://localhost:7002/api/slow
curl http://localhost:7002/api/error
curl http://localhost:7002/api/random
```

7. Refresh the service connection status in AegisOps and open Logs/Metrics.

## Routes

```text
GET  /health
GET  /api/orders
POST /api/orders
GET  /api/slow
GET  /api/error
GET  /api/random
```
