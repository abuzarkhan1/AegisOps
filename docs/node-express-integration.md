# Node Express Integration

Use the local SDK package from `packages/aegisops-node`.

```bash
npm install ../../packages/aegisops-node
```

## Environment

```bash
AEGISOPS_ENABLED=true
AEGISOPS_API_URL=http://localhost:8080
AEGISOPS_API_KEY=YOUR_API_KEY
AEGISOPS_PROJECT_KEY=loan-tracker
AEGISOPS_SERVICE_NAME=loan-tracker-api
AEGISOPS_ENVIRONMENT=production
```

## Middleware

```ts
import express from "express";
import { aegisopsMiddleware, aegisopsErrorHandler } from "@aegisops/node";

const app = express();

app.use(express.json());
app.use(
  aegisopsMiddleware({
    apiUrl: process.env.AEGISOPS_API_URL!,
    apiKey: process.env.AEGISOPS_API_KEY!,
    projectKey: process.env.AEGISOPS_PROJECT_KEY!,
    serviceName: process.env.AEGISOPS_SERVICE_NAME!,
    environment: process.env.AEGISOPS_ENVIRONMENT!,
    slowRequestThresholdMs: 1000,
    batchSize: 20,
    flushIntervalMs: 5000,
  })
);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use(aegisopsErrorHandler());
```

The middleware sends `http_requests_total`, `http_request_duration_ms`, `http_errors_total`, `http_4xx_total`, `http_5xx_total`, `slow_requests_total`, and error logs. The error handler sends `exceptions_total` and an error log with route, method, status code, request id, trace id, and stack metadata.

Request and response bodies are not captured by default.

## Complete Example

```bash
cd examples/monolith-node-express
cp .env.example .env
npm install
npm run dev
```

```bash
curl http://localhost:7001/health
curl http://localhost:7001/api/orders
curl -X POST http://localhost:7001/api/orders -H "Content-Type: application/json" -d '{"sku":"premium-plan","quantity":2}'
curl http://localhost:7001/api/orders/ord_1001
curl http://localhost:7001/api/slow
curl http://localhost:7001/api/error
curl http://localhost:7001/api/random
```

## Manual Log

```bash
curl -X POST http://localhost:8080/ingest/logs \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"projectKey":"loan-tracker","serviceName":"loan-tracker-api","environment":"production","level":"info","message":"manual log from express","requestId":"req_manual"}'
```

## Manual Metric

```bash
curl -X POST http://localhost:8080/metrics-api/metrics/custom \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"projectKey":"loan-tracker","serviceName":"loan-tracker-api","environment":"production","metricName":"orders_total","value":1}'
```

## Batch Metrics

```bash
curl -X POST http://localhost:8080/metrics-api/metrics/batch \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"projectKey":"loan-tracker","serviceName":"loan-tracker-api","environment":"production","metrics":[{"metricName":"http_requests_total","value":1},{"metricName":"http_request_duration_ms","value":42.8}]}'
```

## Troubleshooting

- API key invalid: regenerate the service key in Connect Project and update `AEGISOPS_API_KEY`.
- Service not connected: confirm `projectKey`, `serviceName`, and `environment` match the service created in AegisOps.
- No metrics showing: wait for the SDK batch flush or lower `flushIntervalMs` while testing.
- Wrong project/service: service-scoped keys cannot ingest into another project or service.
- AegisOps down: the SDK retries and drops telemetry without crashing the app; set `debug: true` for warnings.
- CORS issue: server-side Express SDK calls do not use browser CORS; direct browser ingestion must go through allowed origins.
- Localhost vs Docker gateway: external apps on your Mac should use `http://localhost:8080`; code running inside Docker may need `http://host.docker.internal:8080`.
