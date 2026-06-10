import { Router } from "express";
import { env } from "../../config/env";
import { dependencyChecks } from "../../infrastructure/health/dependencyChecks";
import { metricsRegistry } from "../../infrastructure/metrics/registry";
import { asyncHandler } from "../../shared/http/asyncHandler";

export const healthRouter = Router();

const healthHandler = asyncHandler(async (_req, res) => {
  const checks = await dependencyChecks();
  const degraded = Object.values(checks).some((check) => check.status !== "ok");

  res.json({
    status: degraded ? "degraded" : "ok",
    healthStatus: degraded ? "degraded" : "healthy",
    service: env.SERVICE_NAME,
    timestamp: new Date().toISOString(),
    mode: "local",
    dependencies: {
      postgres: checks.postgres?.status === "ok" ? "healthy" : "degraded",
      redis: checks.redis?.status === "ok" ? "healthy" : "degraded",
      kafka: checks.kafka?.status === "ok" ? "healthy" : "degraded",
      rabbitmq: "not_required"
    },
    uptimeSeconds: Math.round(process.uptime()),
    checks
  });
});

healthRouter.get("/health", healthHandler);
healthRouter.get("/api/health", healthHandler);

healthRouter.get(
  "/metrics",
  asyncHandler(async (_req, res) => {
    res.setHeader("Content-Type", metricsRegistry.contentType);
    res.send(await metricsRegistry.metrics());
  })
);

healthRouter.get(
  "/api/metrics",
  asyncHandler(async (_req, res) => {
    res.setHeader("Content-Type", metricsRegistry.contentType);
    res.send(await metricsRegistry.metrics());
  })
);
