import crypto from "node:crypto";
import { env } from "../config/env";
import type { AegisOpsEvent, WorkerTask } from "../events/event.types";
import { db } from "../infrastructure/database/pool";
import { logger } from "../infrastructure/logging/logger";
import type { RabbitMqTaskPublisher } from "../infrastructure/rabbitmq/publisher";

const now = () => new Date().toISOString();

const task = (sourceTopic: string, taskType: string, payload: AegisOpsEvent): WorkerTask => ({
  sourceTopic,
  taskType,
  payload,
  createdAt: now()
});

const shouldEscalate = (severity?: string) => severity === "critical" || severity === "high";

async function saveLogToDb(payload: AegisOpsEvent) {
  const serviceName = (payload.serviceName || "unknown-service") as string;
  const level = (payload.level || "info") as string;
  const message = (payload.message || "") as string;
  const traceId = (payload.traceId || null) as string | null;
  const environment = (payload.environment || "production") as string;
  const metadata = payload.metadata || {};
  const timestamp = payload.timestamp ? new Date(payload.timestamp as string) : new Date();

  try {
    await db.query(
      `
      INSERT INTO logs (id, service_name, level, message, trace_id, environment, metadata, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        crypto.randomUUID(),
        serviceName,
        level,
        message,
        traceId,
        environment,
        JSON.stringify(metadata),
        timestamp
      ]
    );
  } catch (error) {
    logger.error({ error, payload }, "Failed to write log to PostgreSQL");
  }
}

async function publishNotifications(sourceTopic: string, payload: AegisOpsEvent, publisher: RabbitMqTaskPublisher) {
  await publisher.publish("notification.email.send", task(sourceTopic, "notification.email.send", payload));
  await publisher.publish("notification.slack.send", task(sourceTopic, "notification.slack.send", payload));
  await publisher.publish("notification.discord.send", task(sourceTopic, "notification.discord.send", payload));
}

async function createIncidentFromAlert(payload: AegisOpsEvent): Promise<any> {
  if (!payload.organizationId) {
    logger.warn({ payload }, "Skipping incident creation because alert has no organizationId");
    return null;
  }

  const response = await fetch(`${env.CORE_API_URL.replace(/\/$/, "")}/api/incidents`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      organizationId: payload.organizationId,
      projectId: payload.projectId,
      serviceId: payload.serviceId,
      title: payload.title ?? "Alert threshold breached",
      severity: payload.severity ?? "medium",
      summary: payload.summary ?? "Incident created from alerts.triggered event"
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Core API incident creation failed: ${response.status} ${body}`);
  }

  const data = await response.json();
  return data.incident;
}

export async function processEvent(sourceTopic: string, payload: AegisOpsEvent, publisher: RabbitMqTaskPublisher) {
  switch (sourceTopic) {
    case "incidents.created":
      await publisher.publish("ai.analysis.requested", task(sourceTopic, "ai.analysis.requested", payload));
      await publishNotifications(sourceTopic, payload, publisher);
      if (shouldEscalate(payload.severity)) {
        await publisher.publish("incident.escalate", task(sourceTopic, "incident.escalate", payload));
      }
      return;

    case "incidents.resolved":
      await publisher.publish("ai.postmortem.generate", task(sourceTopic, "ai.postmortem.generate", payload));
      await publisher.publish("report.daily.generate", task(sourceTopic, "report.daily.generate", payload));
      return;

    case "incidents.updated":
      await publishNotifications(sourceTopic, payload, publisher);
      return;

    case "alerts.triggered": {
      const incident = await createIncidentFromAlert(payload);
      if (incident) {
        await publisher.publish(
          "ai.analysis.requested",
          task("incidents.created", "ai.analysis.requested", {
            ...payload,
            id: incident.id,
            title: incident.title,
            summary: incident.summary,
            severity: incident.severity
          })
        );
      }
      await publishNotifications(sourceTopic, payload, publisher);
      if (shouldEscalate(payload.severity)) {
        await publisher.publish("incident.escalate", task(sourceTopic, "incident.escalate", payload));
      }
      return;
    }

    case "deployments.created":
    case "deployments.completed":
      await publisher.publish("deployment.impact.analyze", task(sourceTopic, "deployment.impact.analyze", payload));
      return;

    case "deployment.impact.generated":
      await publishNotifications(sourceTopic, payload, publisher);
      return;

    case "logs.received":
      await saveLogToDb(payload);
      return;

    case "logs.enriched":
    case "metrics.received":
    case "metrics.aggregated":
    case "service.health.changed":
    case "audit.events":
      logger.debug({ sourceTopic, serviceName: payload.serviceName }, "Telemetry event observed");
      return;

    default:
      logger.warn({ sourceTopic }, "No worker workflow registered for topic");
  }
}
