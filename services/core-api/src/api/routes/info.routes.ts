import { Router } from "express";
import { coreApiModules } from "../../modules/moduleCatalog";
import { documentedRedisPatterns } from "../../utils/cacheKeys";

export const infoRouter = Router();

infoRouter.get("/api/v1/info", (_req, res) => {
  res.json({
    service: "core-api",
    version: "0.1.0",
    modules: coreApiModules,
    redisKeyPatterns: documentedRedisPatterns,
    kafkaTopics: [
      "logs.received",
      "metrics.received",
      "deployments.created",
      "incidents.created",
      "incidents.updated",
      "incidents.resolved",
      "alerts.triggered",
      "audit.events"
    ],
    rabbitMqQueues: [
      "ai.analysis.requested",
      "ai.postmortem.generate",
      "notification.email.send",
      "notification.slack.send",
      "notification.discord.send",
      "report.daily.generate",
      "report.weekly.generate",
      "incident.escalate",
      "deployment.impact.analyze"
    ]
  });
});
