#!/usr/bin/env bash
set -euo pipefail

node <<'NODE'
const core = "http://localhost:4000";
const gateway = "http://localhost:8080";

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {})
    }
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(`${options.method ?? "GET"} ${url} failed ${response.status}: ${text}`);
  return body;
}

async function main() {
  const suffix = Date.now();
  const registration = await request(`${core}/api/auth/register`, {
    method: "POST",
    body: JSON.stringify({
      email: `demo+${suffix}@aegisops.local`,
      password: "AegisOps123!",
      name: "Demo Admin",
      organizationName: `AegisOps Demo ${suffix}`
    })
  });
  const organizationId = registration.organization.id;

  const loanProject = (await request(`${core}/api/v1/projects`, {
    method: "POST",
    body: JSON.stringify({
      organizationId,
      name: "Loan Tracker",
      projectKey: `loan-tracker-demo-${suffix}`,
      environment: "production",
      projectType: "monolith",
      description: "Monolith backend demo"
    })
  })).project;
  const loanService = (await request(`${core}/api/v1/projects/${loanProject.id}/services`, {
    method: "POST",
    body: JSON.stringify({ name: "loan-tracker-api", environment: "production", serviceType: "api", language: "node" })
  })).service;
  const loanKey = (await request(`${core}/api/v1/services/${loanService.id}/api-keys`, {
    method: "POST",
    body: JSON.stringify({ name: "loan-tracker demo key" })
  })).apiKey.rawKey;

  const commerceProject = (await request(`${core}/api/v1/projects`, {
    method: "POST",
    body: JSON.stringify({
      organizationId,
      name: "Aegis Commerce",
      projectKey: `aegis-commerce-demo-${suffix}`,
      environment: "production",
      projectType: "microservices",
      description: "Microservices demo"
    })
  })).project;
  const commerceServices = [];
  for (const name of ["api-gateway", "auth-service", "payment-service", "order-service", "notification-worker", "redis-cache", "postgres-primary"]) {
    const service = (await request(`${core}/api/v1/projects/${commerceProject.id}/services`, {
      method: "POST",
      body: JSON.stringify({
        name,
        environment: "production",
        serviceType: name.includes("worker") ? "worker" : name.includes("redis") ? "cache" : name.includes("postgres") ? "database" : "api",
        language: name.includes("postgres") || name.includes("redis") ? "infra" : "node"
      })
    })).service;
    commerceServices.push(service);
  }
  const commerceKey = (await request(`${core}/api/v1/services/${commerceServices[0].id}/api-keys`, {
    method: "POST",
    body: JSON.stringify({ name: "aegis-commerce demo key" })
  })).apiKey.rawKey;

  const now = new Date();
  for (let i = 0; i < 12; i += 1) {
    const timestamp = new Date(now.getTime() - i * 60_000).toISOString();
    await request(`${gateway}/ingest/logs`, {
      method: "POST",
      headers: { Authorization: `Bearer ${loanKey}` },
      body: JSON.stringify({
        projectKey: loanProject.projectKey,
        serviceName: loanService.name,
        environment: "production",
        level: i % 5 === 0 ? "error" : "info",
        message: i % 5 === 0 ? "Transaction route database timeout" : "Transaction route completed",
        timestamp,
        traceId: `loan-trace-${i}`,
        requestId: `loan-req-${i}`,
        route: "/api/transactions",
        method: "POST",
        statusCode: i % 5 === 0 ? 500 : 200,
        durationMs: i % 5 === 0 ? 1400 : 220,
        metadata: { db: "mongodb", query: "transactions.aggregate" }
      })
    });
    await request(`${gateway}/metrics-api/metrics/batch`, {
      method: "POST",
      headers: { Authorization: `Bearer ${loanKey}` },
      body: JSON.stringify({
        projectKey: loanProject.projectKey,
        serviceName: loanService.name,
        environment: "production",
        metrics: [
          { metricName: "http_requests_total", value: 18 + i, timestamp, labels: { route: "/api/transactions", method: "POST" } },
          { metricName: "http_request_duration_ms", value: i % 5 === 0 ? 1400 : 240 + i * 4, timestamp, labels: { route: "/api/transactions" } },
          { metricName: "http_5xx_total", value: i % 5 === 0 ? 2 : 0, timestamp, labels: { route: "/api/transactions" } },
          { metricName: "db_query_duration_ms", value: i % 5 === 0 ? 950 : 80 + i, timestamp, labels: { db: "mongodb" } }
        ]
      })
    });
  }

  for (let index = 0; index < commerceServices.length; index += 1) {
    const service = commerceServices[index];
    const timestamp = new Date(now.getTime() - index * 45_000).toISOString();
    await request(`${gateway}/metrics-api/metrics/batch`, {
      method: "POST",
      headers: { Authorization: `Bearer ${commerceKey}` },
      body: JSON.stringify({
        projectKey: commerceProject.projectKey,
        serviceName: service.name,
        serviceId: service.id,
        environment: "production",
        metrics: [
          { metricName: "http_requests_total", value: 40 + index * 4, timestamp, labels: { service: service.name } },
          { metricName: "http_request_duration_ms", value: 160 + index * 35, timestamp, labels: { service: service.name } },
          { metricName: "queue_depth", value: service.name.includes("worker") ? 37 : 0, timestamp, labels: { queue: "notifications" } },
          { metricName: "cache_hit_ratio", value: service.name.includes("redis") ? 91 : 0, timestamp, labels: { cache: "redis" } }
        ]
      })
    });
  }

  console.log(JSON.stringify({
    organizationId,
    loanTracker: { projectId: loanProject.id, serviceId: loanService.id, apiKey: loanKey },
    aegisCommerce: { projectId: commerceProject.id, serviceCount: commerceServices.length, apiKey: commerceKey }
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE
