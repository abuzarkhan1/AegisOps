const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const express = require("express");
const {
  aegisopsMiddleware,
  aegisopsErrorHandler,
  createAegisOpsClient
} = require("../dist/index.js");

function createCollector() {
  const requests = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const bodyText = Buffer.concat(chunks).toString("utf8");
      let body = {};
      try {
        body = bodyText ? JSON.parse(bodyText) : {};
      } catch {
        body = { raw: bodyText };
      }
      requests.push({ method: req.method, url: req.url, headers: req.headers, body });
      res.writeHead(202, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      resolve({
        url: `http://127.0.0.1:${port}`,
        requests,
        close: () => new Promise((done) => server.close(done))
      });
    });
  });
}

function createExpressApp(config, setup) {
  const app = express();
  app.use(express.json());
  app.use(aegisopsMiddleware(config));
  setup(app);
  app.use(aegisopsErrorHandler(config));
  app.use((err, req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    res.status(err.statusCode || err.status || 500).json({ error: err.message });
  });
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(done))
      });
    });
  });
}

async function waitFor(fn, timeoutMs = 2000) {
  const started = Date.now();
  let lastValue;
  while (Date.now() - started < timeoutMs) {
    lastValue = fn();
    if (lastValue) return lastValue;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail("timed out waiting for condition");
}

function metricsNamed(requests, name) {
  return requests
    .filter((request) => request.url === "/metrics-api/metrics/batch")
    .flatMap((request) => request.body.metrics || [])
    .filter((metric) => metric.metricName === name);
}

const baseConfig = (apiUrl) => ({
  apiUrl,
  apiKey: "aeg_test_key",
  projectKey: "test-project",
  serviceName: "test-service",
  environment: "test",
  flushIntervalMs: 1000,
  batchSize: 1,
  slowRequestThresholdMs: 50,
  timeoutMs: 100
});

test("middleware captures a successful request", async () => {
  const collector = await createCollector();
  const app = await createExpressApp(baseConfig(collector.url), (router) => {
    router.get("/ok", (req, res) => res.json({ ok: true }));
  });

  try {
    const response = await fetch(`${app.url}/ok`, { headers: { "x-request-id": "req_1", "x-trace-id": "trace_1" } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-request-id"), "req_1");
    assert.equal(response.headers.get("x-trace-id"), "trace_1");

    await waitFor(() => metricsNamed(collector.requests, "http_requests_total").length > 0);
    assert.equal(metricsNamed(collector.requests, "http_request_duration_ms").length > 0, true);
  } finally {
    await app.close();
    await collector.close();
  }
});

test("middleware captures a 500 response", async () => {
  const collector = await createCollector();
  const app = await createExpressApp(baseConfig(collector.url), (router) => {
    router.get("/boom", (req, res) => res.status(500).json({ error: "boom" }));
  });

  try {
    const response = await fetch(`${app.url}/boom`);
    assert.equal(response.status, 500);

    await waitFor(() => metricsNamed(collector.requests, "http_5xx_total").length > 0);
    assert.equal(metricsNamed(collector.requests, "http_errors_total").length > 0, true);
    await waitFor(() => collector.requests.some((request) => request.url === "/ingest/logs" && request.body.level === "error"));
  } finally {
    await app.close();
    await collector.close();
  }
});

test("error handler sends error log and exception metric", async () => {
  const collector = await createCollector();
  const app = await createExpressApp(baseConfig(collector.url), (router) => {
    router.get("/throw", (req, res, next) => next(new Error("handler failed")));
  });

  try {
    const response = await fetch(`${app.url}/throw`);
    assert.equal(response.status, 500);

    await waitFor(() => metricsNamed(collector.requests, "exceptions_total").length > 0);
    await waitFor(() => collector.requests.some((request) => request.url === "/ingest/logs" && request.body.message === "handler failed"));
  } finally {
    await app.close();
    await collector.close();
  }
});

test("ignored route does not send telemetry", async () => {
  const collector = await createCollector();
  const app = await createExpressApp(baseConfig(collector.url), (router) => {
    router.get("/health", (req, res) => res.json({ ok: true }));
  });

  try {
    const response = await fetch(`${app.url}/health`);
    assert.equal(response.status, 200);
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(collector.requests.length, 0);
  } finally {
    await app.close();
    await collector.close();
  }
});

test("batching flushes metrics by batch size", async () => {
  const collector = await createCollector();
  const client = createAegisOpsClient({ ...baseConfig(collector.url), batchSize: 3, flushIntervalMs: 10_000 });

  try {
    await client.sendMetric({ metricName: "one", value: 1 });
    await client.sendMetric({ metricName: "two", value: 2 });
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(collector.requests.length, 0);

    await client.sendMetric({ metricName: "three", value: 3 });
    await waitFor(() => collector.requests.some((request) => request.url === "/metrics-api/metrics/batch"));
    const batch = collector.requests.find((request) => request.url === "/metrics-api/metrics/batch").body.metrics;
    assert.equal(batch.length, 3);
  } finally {
    await client.shutdown();
    await collector.close();
  }
});

test("disabled SDK sends nothing", async () => {
  const collector = await createCollector();
  const client = createAegisOpsClient({ ...baseConfig(collector.url), enabled: false });

  try {
    await client.sendLog({ message: "disabled" });
    await client.sendMetric({ metricName: "disabled_metric", value: 1 });
    await client.flush();
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(collector.requests.length, 0);
  } finally {
    await client.shutdown();
    await collector.close();
  }
});

test("missing config does not crash app", async () => {
  const app = await createExpressApp({ apiUrl: "http://127.0.0.1:9", timeoutMs: 50 }, (router) => {
    router.get("/ok", (req, res) => res.json({ ok: true }));
  });

  try {
    const response = await fetch(`${app.url}/ok`);
    assert.equal(response.status, 200);
  } finally {
    await app.close();
  }
});

test("failed AegisOps API does not crash app", async () => {
  const app = await createExpressApp({ ...baseConfig("http://127.0.0.1:9"), timeoutMs: 25 }, (router) => {
    router.get("/ok", (req, res) => res.json({ ok: true }));
  });

  try {
    const response = await fetch(`${app.url}/ok`);
    assert.equal(response.status, 200);
    await new Promise((resolve) => setTimeout(resolve, 250));
  } finally {
    await app.close();
  }
});
