# AegisOps Go SDK

Native `net/http` middleware and telemetry client for AegisOps.

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

Environment:

```bash
AEGISOPS_ENABLED=true
AEGISOPS_API_URL=http://localhost:8080
AEGISOPS_API_KEY=YOUR_API_KEY
AEGISOPS_PROJECT_KEY=loan-tracker
AEGISOPS_SERVICE_NAME=loan-tracker-api
AEGISOPS_ENVIRONMENT=production
```

The SDK batches metrics, retries failed sends, propagates request/trace IDs, and does not panic when AegisOps is unavailable.

Run the example service:

```bash
cd examples/go-http-service
set -a && . ./.env && set +a
go run .
```
