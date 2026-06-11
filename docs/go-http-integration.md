# Go HTTP Integration

Use `packages/aegisops-go` to monitor Go `net/http` services with request metrics, slow-request metrics, error logs, and panic telemetry.

## 1. Create Project

Open `/connect-project`, choose a project type, and create the project.

## 2. Create Service

Add a service with language `Go HTTP`. Use the service name exactly as it will appear in `AEGISOPS_SERVICE_NAME`.

## 3. Generate API Key

Generate a service API key in the wizard. SDK requests use:

```txt
Authorization: Bearer YOUR_API_KEY
```

## 4. Install SDK

```bash
go get github.com/aegisops/aegisops-go
```

For local development before publishing:

```bash
go mod edit -replace github.com/aegisops/aegisops-go=/Users/abuzar/Desktop/AegisOps/packages/aegisops-go
```

## 5. Add Env Variables

```bash
AEGISOPS_ENABLED=true
AEGISOPS_API_URL=http://localhost:8080
AEGISOPS_API_KEY=YOUR_API_KEY
AEGISOPS_PROJECT_KEY=loan-tracker
AEGISOPS_SERVICE_NAME=loan-tracker-go
AEGISOPS_ENVIRONMENT=production
AEGISOPS_SLOW_REQUEST_THRESHOLD_MS=1000
AEGISOPS_FLUSH_INTERVAL_MS=5000
AEGISOPS_BATCH_SIZE=20
AEGISOPS_DEBUG=false
```

## 6. Add Middleware

```go
package main

import (
  "net/http"

  aegisops "github.com/aegisops/aegisops-go"
)

func main() {
  client := aegisops.NewClientFromEnv()

  mux := http.NewServeMux()
  mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
    w.WriteHeader(http.StatusOK)
  })

  http.ListenAndServe(":7003", client.Middleware(mux))
}
```

The middleware recovers panics, emits `exceptions_total` plus an error log, and returns `500`.

## 7. Run App

```bash
go run .
```

Or run the included example:

```bash
cd examples/go-http-service
set -a && . ./.env && set +a
go run .
```

## 8. Hit Routes

```bash
curl http://localhost:7003/health
curl http://localhost:7003/api/orders
curl -X POST http://localhost:7003/api/orders -H "Content-Type: application/json" -d '{"sku":"premium-plan","quantity":2}'
curl http://localhost:7003/api/slow
curl http://localhost:7003/api/error
curl http://localhost:7003/api/random
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
- Panics become `500` responses after telemetry capture.
- Health routes are ignored by default: `/health`, `/metrics`, `/favicon.ico`.
