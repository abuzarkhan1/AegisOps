# @aegisops/node

Node.js SDK for sending Express request telemetry to AegisOps.

```bash
npm install @aegisops/node
```

```js
const express = require("express");
const { aegisopsMiddleware, aegisopsErrorHandler, createAegisOpsClient } = require("@aegisops/node");

const app = express();
app.use(express.json());
app.use(
  aegisopsMiddleware({
    slowRequestThresholdMs: 1000,
    batchSize: 20,
    flushIntervalMs: 5000
  })
);

app.get("/health", (req, res) => res.json({ ok: true }));

app.use(aegisopsErrorHandler());
```

Required environment variables:

```bash
AEGISOPS_ENABLED=true
AEGISOPS_API_URL=http://localhost:8080
AEGISOPS_API_KEY=aeg_your_key
AEGISOPS_PROJECT_KEY=your-project
AEGISOPS_SERVICE_NAME=your-service
AEGISOPS_ENVIRONMENT=production
```

Exports:

```ts
aegisopsMiddleware()
aegisopsErrorHandler()
sendLog()
sendMetric()
sendBatchMetrics()
createAegisOpsClient()
```

The middleware emits `http_requests_total`, `http_request_duration_ms`, `http_errors_total`, `http_4xx_total`, `http_5xx_total`, `slow_requests_total`, warning logs for slow requests, and error logs for 500 responses. Metrics are batched in memory and retried with backoff. If AegisOps is unavailable, telemetry is dropped after retries and the monitored application continues running.

Manual client:

```js
const client = createAegisOpsClient({ debug: true });

await client.sendMetric({ metricName: "orders_total", value: 1 });
await client.sendLog({ level: "info", message: "order created" });
await client.flush();
```
