#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

node <<'NODE'
const assert = require("node:assert");
const { spawn } = require("node:child_process");
const { existsSync } = require("node:fs");
const path = require("node:path");

const gateway = "http://localhost:8080";
const core = "http://localhost:4000";
const services = [
  ["gateway", `${gateway}/health`],
  ["dashboard", "http://localhost:5173"],
  ["core-api", `${core}/health`],
  ["log-ingester", "http://localhost:5001/health"],
  ["metrics-service", "http://localhost:5002/health"],
  ["ai-rca", "http://localhost:8000/health"],
  ["notification", "http://localhost:8085/health"],
  ["deployment-tracker", "http://localhost:4010/health"],
  ["worker", "http://localhost:4020/health"]
];

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {})
    }
  });
  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${url} failed: ${response.status} ${text}`);
  }
  return body;
}

async function waitFor(label, fn, timeoutMs = 30000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ""}`);
}

async function runOptionalExampleApp(env) {
  const exampleDir = path.join(process.cwd(), "examples", "monolith-node-express");
  if (!existsSync(path.join(exampleDir, "node_modules", "express")) || !existsSync(path.join(exampleDir, "node_modules", "@aegisops", "node"))) {
    console.log("skip example app routes (dependencies not installed)");
    return;
  }

  const child = spawn(process.execPath, ["src/server.js"], {
    cwd: exampleDir,
    env: {
      ...process.env,
      PORT: "7001",
      AEGISOPS_ENABLED: "true",
      AEGISOPS_API_URL: gateway,
      AEGISOPS_API_KEY: env.apiKey,
      AEGISOPS_PROJECT_KEY: env.projectKey,
      AEGISOPS_SERVICE_NAME: env.serviceName,
      AEGISOPS_ENVIRONMENT: "production"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  try {
    await waitFor("example app health", async () => {
      const response = await fetch("http://localhost:7001/health").catch(() => undefined);
      return response?.ok;
    }, 15000);

    const okRoutes = [
      ["GET", "http://localhost:7001/api/orders"],
      ["GET", "http://localhost:7001/api/orders/ord_1001"],
      ["GET", "http://localhost:7001/api/slow"],
      ["GET", "http://localhost:7001/api/random"]
    ];
    for (const [method, url] of okRoutes) {
      await fetch(url, { method });
    }
    await fetch("http://localhost:7001/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sku: "smoke-plan", quantity: 2 })
    });
    const errorResponse = await fetch("http://localhost:7001/api/error");
    assert(errorResponse.status === 500, "example error route should return 500");
    console.log("ok example app routes");
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
    await new Promise((resolve) => {
      child.once("exit", resolve);
      setTimeout(resolve, 2000);
    });
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
      await new Promise((resolve) => {
        child.once("exit", resolve);
        setTimeout(resolve, 1000);
      });
    }
  }
}

(async () => {
  for (const [name, url] of services) {
    const body = await request(url);
    assert(body, `${name} returned no response`);
    console.log(`ok health ${name}`);
  }

  const suffix = Date.now();
  const email = `smoke+${suffix}@aegisops.local`;
  const password = "AegisOps123!";
  const registration = await request(`${core}/api/auth/register`, {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      name: "Smoke Engineer",
      organizationName: `Smoke Org ${suffix}`
    })
  });
  const login = await request(`${core}/api/auth/login`, {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  assert(login.accessToken, "login did not return an access token");
  const organizationId = registration.organization.id;
  console.log("ok auth register/login");

  const loanProject = (await request(`${core}/api/v1/projects`, {
    method: "POST",
    body: JSON.stringify({
      organizationId,
      name: "Loan Tracker",
      projectKey: `loan-tracker-${suffix}`,
      environment: "production",
      projectType: "monolith",
      description: "Monolith demo project"
    })
  })).project;
  const loanService = (await request(`${core}/api/v1/projects/${loanProject.id}/services`, {
    method: "POST",
    body: JSON.stringify({
      name: "loan-tracker-api",
      environment: "production",
      serviceType: "api",
      language: "node"
    })
  })).service;

  const commerceProject = (await request(`${core}/api/v1/projects`, {
    method: "POST",
    body: JSON.stringify({
      organizationId,
      name: "Aegis Commerce",
      projectKey: `aegis-commerce-${suffix}`,
      environment: "production",
      projectType: "microservices",
      description: "Microservices demo project"
    })
  })).project;
  for (const name of ["api-gateway", "auth-service", "payment-service", "order-service", "notification-worker", "redis-cache", "postgres-primary"]) {
    await request(`${core}/api/v1/projects/${commerceProject.id}/services`, {
      method: "POST",
      body: JSON.stringify({
        name,
        environment: "production",
        serviceType: name.includes("worker") ? "worker" : name.includes("redis") ? "cache" : name.includes("postgres") ? "database" : "api",
        language: name.includes("postgres") || name.includes("redis") ? "infra" : "node"
      })
    });
  }
  const v1Projects = await request(`${core}/api/v1/projects?organizationId=${organizationId}`);
  assert(v1Projects.projects.some((item) => item.id === loanProject.id), "v1 projects did not include created project");
  const v1Services = await request(`${core}/api/v1/projects/${loanProject.id}/services`);
  assert(v1Services.services.some((item) => item.id === loanService.id), "v1 services did not include created service");
  console.log("ok projects/services");

  const apiKey = (await request(`${core}/api/v1/services/${loanService.id}/api-keys`, {
    method: "POST",
    body: JSON.stringify({ name: "smoke ingestion key" })
  })).apiKey.rawKey;
  assert(apiKey, "api key was not generated");
  console.log("ok api key");

  await request(`${core}/api/alert-rules`, {
    method: "POST",
    body: JSON.stringify({
      organizationId,
      serviceId: loanService.id,
      name: "Smoke high latency",
      metric: "http_request_duration_ms",
      operator: "gt",
      threshold: 1000,
      durationSeconds: 60,
      severity: "high",
      enabled: true
    })
  });
  await request(`${core}/api/alert-rules`, {
    method: "POST",
    body: JSON.stringify({
      organizationId,
      serviceId: loanService.id,
      name: "Smoke error logs",
      metric: "error_logs",
      operator: "gt",
      threshold: 0,
      durationSeconds: 60,
      severity: "medium",
      enabled: true
    })
  });
  console.log("ok alert rules");

  const initialConnectionStatus = await request(`${core}/api/v1/services/${loanService.id}/connection-status`);
  assert(initialConnectionStatus.status === "not_connected", `expected not_connected before telemetry, got ${initialConnectionStatus.status}`);
  const testEventResponse = await request(`${core}/api/v1/services/${loanService.id}/test-event`, { method: "POST" });
  assert(
    testEventResponse.connectionStatus.status === "waiting_for_telemetry",
    `expected waiting_for_telemetry after test event, got ${testEventResponse.connectionStatus.status}`
  );
  console.log("ok initial/test connection status");

  const traceId = `trace_${suffix}`;
  const requestId = `req_${suffix}`;
  await request(`${gateway}/ingest/logs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      projectKey: loanProject.projectKey,
      serviceName: loanService.name,
      environment: "production",
      level: "error",
      message: "Database query timeout",
      traceId,
      requestId,
      route: "/api/transactions",
      method: "POST",
      statusCode: 500,
      durationMs: 1240,
      metadata: { db: "mongodb", query: "transactions.aggregate", userId: "u_123" }
    })
  });
  await request(`${gateway}/metrics-api/metrics/custom`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      projectKey: loanProject.projectKey,
      serviceName: loanService.name,
      environment: "production",
      metricName: "http_request_duration_ms",
      value: 1500,
      labels: { route: "/api/transactions", method: "POST", statusCode: "200" }
    })
  });
  await request(`${gateway}/metrics-api/metrics/batch`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      projectKey: loanProject.projectKey,
      serviceName: loanService.name,
      environment: "production",
      metrics: [
        { metricName: "http_requests_total", value: 1, labels: { route: "/api/transactions", method: "POST", statusCode: "200" } },
        { metricName: "http_errors_total", value: 1, labels: { route: "/api/transactions", method: "POST", statusCode: "500" } },
        { metricName: "http_5xx_total", value: 1, timestamp: new Date().toISOString(), labels: { route: "/api/transactions", method: "POST", statusCode: "500" } },
        { metricName: "slow_requests_total", value: 1, labels: { route: "/api/transactions", method: "POST", statusCode: "500" } }
      ]
    })
  });
  const connectionStatus = await waitFor("service connection status", async () => {
    const status = await request(`${core}/api/v1/services/${loanService.id}/connection-status`);
    return status.connected ? status : null;
  });
  assert(connectionStatus.lastLogAt, "connection status missing lastLogAt");
  assert(connectionStatus.lastMetricAt, "connection status missing lastMetricAt");
  assert(["connected", "erroring"].includes(connectionStatus.status), `connection status should be connected/erroring, got ${connectionStatus.status}`);
  assert(typeof connectionStatus.logsLast15m === "number", "connection status missing logsLast15m");
  assert(typeof connectionStatus.metricsLast15m === "number", "connection status missing metricsLast15m");
  console.log("ok connection status");
  console.log("ok ingestion");

  const incident = (await request(`${core}/api/incidents`, {
    method: "POST",
    body: JSON.stringify({
      organizationId,
      projectId: loanProject.id,
      serviceId: loanService.id,
      title: "Smoke manual incident",
      severity: "medium",
      summary: "Manual incident for smoke coverage"
    })
  })).incident;
  assert(incident.id, "incident was not created");

  await waitFor("logs search", async () => {
    const logs = await request(`${core}/api/logs?requestId=${encodeURIComponent(requestId)}&limit=5`);
    return logs.logs?.length > 0;
  });
  await waitFor("metrics raw rows", async () => {
    const metrics = await request(`${core}/api/telemetry/metrics?serviceId=${loanService.id}&limit=20`);
    return metrics.metrics?.length >= 2;
  });
  await waitFor("slow and error metrics", async () => {
    const metrics = await request(`${core}/api/telemetry/metrics?serviceId=${loanService.id}&limit=50`);
    const names = new Set(metrics.metrics?.map((metric) => metric.metricName));
    return names.has("slow_requests_total") && names.has("http_errors_total") && names.has("http_5xx_total");
  });
  await waitFor("metric aggregates", async () => {
    const aggregates = await request(`${core}/api/telemetry/metric-aggregates?serviceId=${loanService.id}&window=1m&limit=20`);
    return aggregates.aggregates?.length >= 1;
  });
  await waitFor("alert incident", async () => {
    const incidents = await request(`${core}/api/incidents?organizationId=${organizationId}`);
    return incidents.incidents?.some((item) => String(item.title).startsWith("Alert:"));
  });
  console.log("ok persistence/alerts");

  const ai = await request(`${gateway}/ai/analyze-incident`, {
    method: "POST",
    body: JSON.stringify({
      incidentId: incident.id,
      organizationId,
      serviceId: loanService.id,
      serviceName: loanService.name,
      environment: "production",
      severity: "medium",
      logs: [{ level: "error", message: "Database query timeout", metadata: { route: "/api/transactions" } }],
      metricsSummary: { errorRate: 8.5, p95LatencyMs: 1500 }
    })
  });
  assert(ai.summary, "AI RCA did not return summary");
  await request(`${core}/api/incidents/${incident.id}/ai-analysis`, {
    method: "POST",
    body: JSON.stringify({
      summary: ai.summary,
      likelyRootCause: ai.likelyRootCause,
      confidenceScore: ai.confidenceScore,
      evidence: ai.evidence,
      recommendedActions: ai.recommendedActions,
      rollbackRecommendation: ai.rollbackRecommendation,
      postmortemDraft: ai.postmortemDraft
    })
  });
  const savedAi = await request(`${core}/api/incidents/${incident.id}/ai-analysis`);
  assert(savedAi.status === "complete" && savedAi.analysis?.length > 0, "AI RCA report was not saved");

  const deployment = (await request(`${gateway}/deployments/github`, {
    method: "POST",
    body: JSON.stringify({
      organizationId,
      projectId: loanProject.id,
      serviceId: loanService.id,
      serviceName: loanService.name,
      environment: "production",
      version: `v${suffix}`,
      commitSha: "abc123",
      branch: "main",
      status: "completed",
      deployedBy: "smoke"
    })
  })).deployment;
  await request(`${gateway}/deployments/${deployment.id}/impact`, {
    method: "POST",
    body: JSON.stringify({
      summary: "Latency and error rate increased after deployment.",
      risk: "high",
      beforeMetrics: { errorRate: 0.2, p95LatencyMs: 300 },
      afterMetrics: { errorRate: 8.2, p95LatencyMs: 1500 },
      recommendation: "Prepare rollback if error rate does not recover."
    })
  });
  const impact = await request(`${gateway}/deployments/${deployment.id}/impact`);
  assert(impact.impact?.risk === "high", "deployment impact was not saved");

  const summary = await request(`${core}/api/dashboard/summary?organizationId=${organizationId}`);
  assert(summary.summary.projectsMonitored >= 2, "dashboard summary did not include projects");
  console.log("ok ai/dashboard/deployment impact");

  await runOptionalExampleApp({ apiKey, projectKey: loanProject.projectKey, serviceName: loanService.name });

  // --- PHASE 3 VERIFICATIONS ---

  // 1. Ingest at least 100 sample metrics with variable latency
  console.log("ingesting 100 sample metrics with variable latency...");
  for (let i = 0; i < 100; i++) {
    let latencyVal = 50;
    if (i % 20 === 0) latencyVal = 1200; // p99 range
    else if (i % 10 === 0) latencyVal = 800;  // p95 range
    else latencyVal = 30 + (i % 40);

    await request(`${gateway}/metrics-api/metrics/custom`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        projectKey: loanProject.projectKey,
        serviceName: loanService.name,
        environment: "production",
        metricName: "http_request_duration_ms",
        value: latencyVal,
        timestamp: new Date().toISOString(),
        labels: { route: `/api/items/${i % 5}`, method: "GET", statusCode: i % 25 === 0 ? "500" : "200" }
      })
    });
  }
  console.log("ok 100 metrics ingested");

  // 2. Run/trigger manual rollup
  console.log("triggering manual rollup job...");
  const rollupResult = await request(`http://localhost:4020/jobs/rollup`, { method: "POST" });
  assert(Array.isArray(rollupResult.rollups), "manual rollup response must include rollup results");
  assert(rollupResult.rollups.some((rollup) => rollup.window === "1m"), "manual rollup response must include the 1m window");
  console.log("ok rollup triggered");

  // 3. Verify p50/p95/p99 are present in aggregates
  console.log("verifying aggregates percentiles...");
  const aggregates = await request(`${core}/api/telemetry/metric-aggregates?serviceId=${loanService.id}&window=1m&limit=20`);
  assert(aggregates.aggregates?.length > 0, "No aggregates calculated");
  const sampleAgg = aggregates.aggregates[0];
  assert(typeof sampleAgg.p50 === "number", "p50 must be a number");
  assert(typeof sampleAgg.p95 === "number", "p95 must be a number");
  assert(typeof sampleAgg.p99 === "number", "p99 must be a number");
  console.log(`ok aggregates percentiles verified: p50=${sampleAgg.p50}, p95=${sampleAgg.p95}, p99=${sampleAgg.p99}`);

  // 4. Verify detail and route performance APIs
  console.log("verifying project detail, service detail, and route performance APIs...");
  const projDetail = await request(`${core}/api/projects/${loanProject.id}`);
  assert(projDetail.project.id === loanProject.id, "invalid project detail response");

  const servDetail = await request(`${core}/api/services/${loanService.id}`);
  assert(servDetail.service.id === loanService.id, "invalid service detail response");

  const detailTo = new Date().toISOString();
  const detailFrom = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const detailQuery = `from=${encodeURIComponent(detailFrom)}&to=${encodeURIComponent(detailTo)}`;
  const projectSummary = await request(`${core}/api/projects/${loanProject.id}/detail-summary?${detailQuery}`);
  assert(typeof projectSummary.summary?.requestsPerSecond === "number", "project detail summary must include requestsPerSecond");
  assert(projectSummary.summary.requestsPerSecond > 0, "project detail requestsPerSecond should be derived from live telemetry");
  assert(!("windowSeconds" in projectSummary.summary), "project detail summary must not expose internal windowSeconds");

  const serviceSummary = await request(`${core}/api/services/${loanService.id}/detail-summary?${detailQuery}`);
  assert(typeof serviceSummary.summary?.requestsPerSecond === "number", "service detail summary must include requestsPerSecond");
  assert(serviceSummary.summary.requestsPerSecond > 0, "service detail requestsPerSecond should be derived from live telemetry");
  assert(!("windowSeconds" in serviceSummary.summary), "service detail summary must not expose internal windowSeconds");

  const routePerf = await request(`${core}/api/v1/projects/${loanProject.id}/services/${loanService.id}/routes/performance`);
  assert(Array.isArray(routePerf.performance), "route performance must be an array");
  assert(routePerf.performance.length > 0, "route performance should return at least one route");
  assert(routePerf.performance.some((route) => typeof route.errorCount === "number"), "route performance must include errorCount");
  assert(routePerf.performance.some((route) => typeof route.lastSeen === "string"), "route performance must include lastSeen");
  console.log("ok detail APIs verified");

  // 5. Verify org isolation test
  console.log("verifying tenant isolation rules...");
  const suffixB = suffix + "_orgB";
  const emailB = `smoke+${suffixB}@aegisops.local`;
  const registrationB = await request(`${core}/api/auth/register`, {
    method: "POST",
    body: JSON.stringify({
      email: emailB,
      password,
      name: "Smoke Engineer B",
      organizationName: `Smoke Org B ${suffix}`
    })
  });
  const loginB = await request(`${core}/api/auth/login`, {
    method: "POST",
    body: JSON.stringify({ email: emailB, password })
  });
  const tokenB = loginB.accessToken;
  const orgBId = registrationB.organization.id;

  // Try to read Org A projects/logs using Org B token -> must fail
  try {
    await request(`${core}/api/projects?organizationId=${organizationId}`, {
      headers: { "Authorization": `Bearer ${tokenB}` }
    });
    assert.fail("User B was able to list projects of Org A!");
  } catch (err) {
    assert(err.message.includes("403"), "Expected 403 Forbidden for cross-org projects lookup");
  }

  try {
    await request(`${core}/api/logs?organizationId=${organizationId}`, {
      headers: { "Authorization": `Bearer ${tokenB}` }
    });
    assert.fail("User B was able to read logs of Org A!");
  } catch (err) {
    assert(err.message.includes("403"), "Expected 403 Forbidden for cross-org logs query");
  }

  // Create service in Org B to test cross-org API key ingestion check
  const projectB = (await request(`${core}/api/v1/projects`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${tokenB}` },
    body: JSON.stringify({
      organizationId: orgBId,
      name: "Org B Project",
      projectKey: `org-b-project-${suffix}`,
      environment: "production",
      description: "Org B project description"
    })
  })).project;
  const serviceB = (await request(`${core}/api/v1/projects/${projectB.id}/services`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${tokenB}` },
    body: JSON.stringify({
      name: "org-b-service",
      environment: "production",
      serviceType: "api",
      language: "node"
    })
  })).service;

  const apiKeyB = (await request(`${core}/api/v1/services/${serviceB.id}/api-keys`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${tokenB}` },
    body: JSON.stringify({ name: "org B ingestion key" })
  })).apiKey.rawKey;

  // Try to ingest into Org A service (Loan Service) using Org B's API key -> must fail
  try {
    await request(`${gateway}/ingest/logs`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKeyB}` },
      body: JSON.stringify({
        projectKey: loanProject.projectKey, // Org A project key
        serviceName: loanService.name,     // Org A service name
        environment: "production",
        level: "error",
        message: "Unauthorized injection attempt",
        timestamp: new Date().toISOString()
      })
    });
    assert.fail("API Key from Org B was able to ingest logs into Org A project!");
  } catch (err) {
    assert(err.message.includes("401") || err.message.includes("403") || err.message.includes("unauthorized"), "Expected 401/403 for cross-org ingestion");
  }
  console.log("ok tenant isolation verified");

  console.log("SMOKE PASS");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE
