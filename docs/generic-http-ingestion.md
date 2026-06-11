# Generic HTTP Ingestion

Generic clients can send telemetry directly to the gateway with a service API key. Use `Authorization: Bearer <api-key>` for new integrations. The legacy `X-API-Key` header remains available for compatibility.

`timestamp` is optional for logs and metrics. If omitted, AegisOps records the receive time.

## Log

```bash
curl -X POST http://localhost:8080/ingest/logs \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "projectKey": "loan-tracker",
    "serviceName": "loan-tracker-api",
    "environment": "production",
    "level": "info",
    "message": "order created",
    "requestId": "req_123",
    "traceId": "trace_123",
    "route": "/api/orders",
    "method": "POST",
    "statusCode": 201,
    "durationMs": 42.8,
    "metadata": { "orderId": "ord_1001" }
  }'
```

## Metric

```bash
curl -X POST http://localhost:8080/metrics-api/metrics/custom \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "projectKey": "loan-tracker",
    "serviceName": "loan-tracker-api",
    "environment": "production",
    "metricName": "orders_total",
    "value": 1,
    "labels": { "route": "/api/orders", "method": "POST" }
  }'
```

## Batch Metrics

```bash
curl -X POST http://localhost:8080/metrics-api/metrics/batch \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "projectKey": "loan-tracker",
    "serviceName": "loan-tracker-api",
    "environment": "production",
    "metrics": [
      { "metricName": "http_requests_total", "value": 1, "labels": { "route": "/api/orders", "method": "GET", "statusCode": "200" } },
      { "metricName": "http_request_duration_ms", "value": 42.8, "labels": { "route": "/api/orders", "method": "GET", "statusCode": "200" } },
      { "metricName": "slow_requests_total", "value": 1, "labels": { "route": "/api/slow", "method": "GET", "statusCode": "200" } }
    ]
  }'
```

## Errors

Invalid or revoked API keys return:

```json
{
  "success": false,
  "error": "Invalid or revoked API key"
}
```

## Troubleshooting

- API key invalid: generate a fresh key for the exact service.
- Service not connected: send one log and one metric with the service key, then refresh connection status.
- No metrics showing: verify the metric endpoint is `/metrics-api/metrics/custom` or `/metrics-api/metrics/batch`.
- Wrong `projectKey` or `serviceName`: service-scoped keys are rejected when they do not match the validated service context.
- AegisOps down: retry later; ingestion endpoints return 502/503 while dependencies are unavailable.
- CORS issue: prefer server-side ingestion. Browser clients need allowed origins at the gateway.
- Localhost vs Docker gateway: host apps use `http://localhost:8080`; Dockerized monitored apps often need `http://host.docker.internal:8080`.
