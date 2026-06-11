# Connect Your Project

AegisOps connects external projects through service-scoped ingestion keys. The dashboard flow is available at `/connect-project`.

## Flow

1. Choose a project type: monolith, microservices, worker / queue, frontend, or hybrid.
2. Enter project details: name, project key, environment, optional repository URL, and owner team.
3. Add one or more services with service name, type, and framework.
4. Generate service API keys.
5. Copy env config and framework instructions.
6. Send a test event.
7. Start the real app and verify live logs/metrics.
8. Open the project dashboard, logs, or metrics from the verification panel.

## API Surface

```http
POST /api/v1/projects
GET /api/v1/projects
GET /api/v1/projects/:id
POST /api/v1/projects/:id/services
GET /api/v1/projects/:id/services
POST /api/v1/services/:id/api-keys
GET /api/v1/services/:id/api-keys
GET /api/api-keys
POST /api/api-keys/:id/rotate
DELETE /api/api-keys/:id
GET /api/v1/services/:id/connection-status
POST /api/v1/services/:id/test-event
```

Connection status returns:

```json
{
  "serviceId": "service-id",
  "connected": true,
  "status": "connected",
  "lastLogAt": "2026-06-11T07:00:00.000Z",
  "lastMetricAt": "2026-06-11T07:00:05.000Z",
  "lastHeartbeatAt": "2026-06-11T07:00:05.000Z",
  "logsLast15m": 120,
  "metricsLast15m": 900,
  "errorRateLast15m": 1.2,
  "p95LatencyLast15m": 420,
  "telemetryHealth": {
    "logs": "receiving",
    "metrics": "receiving",
    "alerts": "active"
  }
}
```

Status values:

```text
not_connected
waiting_for_telemetry
connected
stale
erroring
```

`waiting_for_telemetry` means only the dashboard test event has been seen. `connected` requires recent real app logs or metrics.

## Express Env

```bash
AEGISOPS_ENABLED=true
AEGISOPS_API_URL=http://localhost:8080
AEGISOPS_API_KEY=YOUR_API_KEY
AEGISOPS_PROJECT_KEY=loan-tracker
AEGISOPS_SERVICE_NAME=loan-tracker-api
AEGISOPS_ENVIRONMENT=production
```

## SDKs

- Node Express: `packages/aegisops-node`
- Python FastAPI: `packages/aegisops-python`
- Java Spring Boot: `packages/aegisops-java`
- Go HTTP: `packages/aegisops-go`

Example apps:

- Node Express: `examples/monolith-node-express`
- Python FastAPI: `examples/fastapi-service`
- Java Spring Boot: `examples/springboot-service`
- Go HTTP: `examples/go-http-service`

Integration guides:

- `docs/node-express-integration.md`
- `docs/python-fastapi-integration.md`
- `docs/java-spring-boot-integration.md`
- `docs/go-http-integration.md`

## Manual Verification

```bash
curl -X POST http://localhost:8080/ingest/logs \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"projectKey":"loan-tracker","serviceName":"loan-tracker-api","environment":"production","level":"info","message":"manual verification log","requestId":"req_verify"}'
```

```bash
curl -X POST http://localhost:8080/metrics-api/metrics/custom \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"projectKey":"loan-tracker","serviceName":"loan-tracker-api","environment":"production","metricName":"http_requests_total","value":1}'
```

```bash
curl -X POST http://localhost:8080/metrics-api/metrics/batch \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"projectKey":"loan-tracker","serviceName":"loan-tracker-api","environment":"production","metrics":[{"metricName":"http_requests_total","value":1},{"metricName":"http_request_duration_ms","value":42.8}]}'
```

## Troubleshooting

- API key invalid: regenerate the service key and update the app env.
- Service not connected: test events are not enough; send real app logs or metrics.
- No metrics showing: wait for SDK flush or send a manual metric curl.
- Wrong projectKey/serviceName: use the values shown in Connect Project for that service.
- AegisOps down: monitored apps continue running; SDK retries and drops telemetry after failures.
- CORS issue: direct browser ingestion needs gateway CORS; server apps do not.
- Localhost vs Docker gateway: host apps use `localhost`; Dockerized apps may need `host.docker.internal`.
