# Go HTTP Integration

Use the local SDK package from `packages/aegisops-go`.

```bash
go get github.com/aegisops/aegisops-go
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

Middleware:

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

The SDK batches metrics, retries failed sends, adds `x-request-id` and `x-trace-id`, emits request/error/slow-request metrics, and does not panic if AegisOps is down.
