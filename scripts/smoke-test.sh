#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

node <<'NODE'
const assert = require("node:assert");

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

  const loanProject = (await request(`${core}/api/projects`, {
    method: "POST",
    body: JSON.stringify({
      organizationId,
      name: "Loan Tracker",
      projectKey: `loan-tracker-${suffix}`,
      environment: "production",
      description: "Monolith demo project"
    })
  })).project;
  const loanService = (await request(`${core}/api/projects/${loanProject.id}/services`, {
    method: "POST",
    body: JSON.stringify({
      name: "loan-tracker-api",
      environment: "production",
      serviceType: "api",
      language: "node"
    })
  })).service;

  const commerceProject = (await request(`${core}/api/projects`, {
    method: "POST",
    body: JSON.stringify({
      organizationId,
      name: "Aegis Commerce",
      projectKey: `aegis-commerce-${suffix}`,
      environment: "production",
      description: "Microservices demo project"
    })
  })).project;
  for (const name of ["api-gateway", "auth-service", "payment-service", "order-service", "notification-worker", "redis-cache", "postgres-primary"]) {
    await request(`${core}/api/projects/${commerceProject.id}/services`, {
      method: "POST",
      body: JSON.stringify({
        name,
        environment: "production",
        serviceType: name.includes("worker") ? "worker" : name.includes("redis") ? "cache" : name.includes("postgres") ? "database" : "api",
        language: name.includes("postgres") || name.includes("redis") ? "infra" : "node"
      })
    });
  }
  console.log("ok projects/services");

  const apiKey = (await request(`${core}/api/services/${loanService.id}/api-keys`, {
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

  const traceId = `trace_${suffix}`;
  const requestId = `req_${suffix}`;
  await request(`${gateway}/ingest/logs`, {
    method: "POST",
    headers: { "X-API-Key": apiKey },
    body: JSON.stringify({
      projectKey: loanProject.projectKey,
      serviceName: loanService.name,
      environment: "production",
      level: "error",
      message: "Database query timeout",
      timestamp: new Date().toISOString(),
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
    headers: { "X-API-Key": apiKey },
    body: JSON.stringify({
      projectKey: loanProject.projectKey,
      serviceName: loanService.name,
      environment: "production",
      metricName: "http_request_duration_ms",
      value: 1500,
      timestamp: new Date().toISOString(),
      labels: { route: "/api/transactions", method: "POST", statusCode: "200" }
    })
  });
  await request(`${gateway}/metrics-api/metrics/batch`, {
    method: "POST",
    headers: { "X-API-Key": apiKey },
    body: JSON.stringify({
      projectKey: loanProject.projectKey,
      serviceName: loanService.name,
      environment: "production",
      metrics: [
        { metricName: "http_requests_total", value: 1, timestamp: new Date().toISOString(), labels: { route: "/api/transactions", method: "POST", statusCode: "200" } },
        { metricName: "http_5xx_total", value: 1, timestamp: new Date().toISOString(), labels: { route: "/api/transactions", method: "POST", statusCode: "500" } }
      ]
    })
  });
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
  console.log("SMOKE PASS");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE
