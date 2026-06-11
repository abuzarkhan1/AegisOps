# AegisOps Go HTTP Example

Small `net/http` app wired to `packages/aegisops-go`.

## Run

1. Start AegisOps from the repository root.
2. Open `/connect-project`, create a project and a Go HTTP service.
3. Generate the service API key.
4. Copy `.env.example` to `.env` and set `AEGISOPS_API_KEY`.
5. Start:

```bash
set -a && . ./.env && set +a
go run .
```

6. Hit routes:

```bash
curl http://localhost:7003/health
curl http://localhost:7003/api/orders
curl -X POST http://localhost:7003/api/orders -H "Content-Type: application/json" -d '{"sku":"premium-plan","quantity":2}'
curl http://localhost:7003/api/slow
curl http://localhost:7003/api/error
curl http://localhost:7003/api/random
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
