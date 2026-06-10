import { Router } from "express";
import { env } from "../../config/env";
import { dependencyChecks } from "../../infrastructure/health/dependencyChecks";
import { kafkaTopicsConsumed, rabbitMqQueuesProduced } from "../../queues/catalog";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
  const checks = await dependencyChecks();
  const degraded = Object.values(checks).some((check) => check.status !== "ok");

  res.json({
    status: degraded ? "degraded" : "ok",
    service: env.SERVICE_NAME,
    consumerGroup: env.KAFKA_CONSUMER_GROUP,
    kafkaTopicsConsumed,
    rabbitMqQueuesProduced,
    checks
  });
});

