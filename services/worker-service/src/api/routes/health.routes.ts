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
    healthStatus: degraded ? "degraded" : "healthy",
    service: env.SERVICE_NAME,
    timestamp: new Date().toISOString(),
    mode: "local",
    dependencies: {
      postgres: checks.postgres?.status === "ok" ? "healthy" : "degraded",
      redis: checks.redis?.status === "ok" ? "healthy" : "degraded",
      kafka: checks.kafka?.status === "ok" ? "healthy" : "degraded",
      rabbitmq: checks.rabbitmq?.status === "ok" ? "healthy" : "degraded"
    },
    consumerGroup: env.KAFKA_CONSUMER_GROUP,
    kafkaTopicsConsumed,
    rabbitMqQueuesProduced,
    checks
  });
});

healthRouter.get("/metrics", (_req, res) => {
  res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.send(
    [
      "# HELP aegisops_worker_uptime_seconds Worker service uptime in seconds.",
      "# TYPE aegisops_worker_uptime_seconds gauge",
      `aegisops_worker_uptime_seconds{service="${env.SERVICE_NAME}"} ${Math.round(process.uptime())}`,
      "# HELP aegisops_worker_kafka_topics_configured Kafka topics configured for consumption.",
      "# TYPE aegisops_worker_kafka_topics_configured gauge",
      `aegisops_worker_kafka_topics_configured{service="${env.SERVICE_NAME}"} ${kafkaTopicsConsumed.length}`,
      "# HELP aegisops_worker_rabbitmq_queues_configured RabbitMQ queues configured for production.",
      "# TYPE aegisops_worker_rabbitmq_queues_configured gauge",
      `aegisops_worker_rabbitmq_queues_configured{service="${env.SERVICE_NAME}"} ${rabbitMqQueuesProduced.length}`
    ].join("\n")
  );
});
