# AegisOps Express Monolith Example

This is a small Express app that emits AegisOps request metrics, slow-request metrics, error metrics, and logs through `@aegisops/node`.

## Run

1. Start AegisOps from the repository root.
2. Open `/connect-project` and create a monolith project.
3. Create a service named `loan-tracker-api`.
4. Generate and copy the service API key.
5. Copy `.env.example` to `.env` and set `AEGISOPS_API_KEY`.
6. Install and start the app:

```bash
npm install
npm run dev
```

7. Hit sample routes:

```bash
curl http://localhost:7001/health
curl http://localhost:7001/api/orders
curl -X POST http://localhost:7001/api/orders -H "Content-Type: application/json" -d '{"sku":"premium-plan","quantity":2}'
curl http://localhost:7001/api/orders/ord_1001
curl http://localhost:7001/api/slow
curl http://localhost:7001/api/error
curl http://localhost:7001/api/random
```

8. Return to AegisOps and view the project dashboard, logs, and metrics.

## Routes

```text
GET  /health
GET  /api/orders
POST /api/orders
GET  /api/orders/:id
GET  /api/slow
GET  /api/error
GET  /api/random
```
