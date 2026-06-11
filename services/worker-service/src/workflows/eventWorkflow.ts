import crypto from "node:crypto";
import { env } from "../config/env";
import type { AegisOpsEvent, WorkerTask } from "../events/event.types";
import { db } from "../infrastructure/database/pool";
import { logger } from "../infrastructure/logging/logger";
import type { RabbitMqTaskPublisher } from "../infrastructure/rabbitmq/publisher";
import { clearTelemetryCaches } from "../infrastructure/redis/cacheInvalidation";

const now = () => new Date().toISOString();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const aggregateWindows = [
  { name: "1m", ms: 60_000 },
  { name: "5m", ms: 5 * 60_000 },
  { name: "15m", ms: 15 * 60_000 },
  { name: "1h", ms: 60 * 60_000 },
  { name: "1d", ms: 24 * 60 * 60_000 }
];

const task = (sourceTopic: string, taskType: string, payload: AegisOpsEvent): WorkerTask => ({
  sourceTopic,
  taskType,
  payload,
  createdAt: now()
});

const shouldEscalate = (severity?: string) => severity === "critical" || severity === "high";
const uuidOrNull = (value: unknown) => (typeof value === "string" && uuidPattern.test(value) ? value : null);
const stringOrNull = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
const numberOrNull = (value: unknown) => {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(numeric) ? numeric : null;
};
const objectOrEmpty = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const bucketFor = (timestamp: Date, windowMs: number) => new Date(Math.floor(timestamp.getTime() / windowMs) * windowMs);

async function saveLogToDb(payload: AegisOpsEvent) {
  const serviceName = (payload.serviceName || "unknown-service") as string;
  const level = (payload.level || "info") as string;
  const message = (payload.message || "") as string;
  const traceId = (payload.traceId || null) as string | null;
  const environment = (payload.environment || "production") as string;
  const metadata = objectOrEmpty(payload.metadata);
  const timestamp = payload.timestamp ? new Date(payload.timestamp as string) : new Date();

  try {
    await db.query(
      `
      INSERT INTO logs (
        id,
        organization_id,
        project_id,
        service_id,
        project_key,
        service_name,
        level,
        message,
        trace_id,
        request_id,
        span_id,
        parent_span_id,
        route,
        method,
        status_code,
        duration_ms,
        environment,
        metadata,
        timestamp
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      `,
      [
        crypto.randomUUID(),
        uuidOrNull(payload.organizationId),
        uuidOrNull(payload.projectId),
        uuidOrNull(payload.serviceId),
        stringOrNull(payload.projectKey),
        serviceName,
        level,
        message,
        traceId,
        stringOrNull(payload.requestId),
        stringOrNull(payload.spanId),
        stringOrNull(payload.parentSpanId),
        stringOrNull(payload.route),
        stringOrNull(payload.method),
        numberOrNull(payload.statusCode),
        numberOrNull(payload.durationMs),
        environment,
        JSON.stringify(metadata),
        timestamp
      ]
    );
  } catch (error) {
    logger.error({ error, payload }, "Failed to write log to PostgreSQL");
  }
}

type MetricPoint = {
  metricName: string;
  value: number;
  labels: Record<string, unknown>;
  timestamp: Date;
};

const metricPointsFromPayload = (payload: AegisOpsEvent): MetricPoint[] => {
  const labels = objectOrEmpty(payload.labels);
  const timestamp = payload.timestamp ? new Date(payload.timestamp as string) : new Date();
  const points: MetricPoint[] = [];

  const directName = stringOrNull(payload.metricName);
  const directValue = numberOrNull(payload.value);
  if (directName && directValue !== null) {
    points.push({ metricName: directName, value: directValue, labels, timestamp });
  }

  const metrics = objectOrEmpty(payload.metrics);
  for (const [metricName, rawValue] of Object.entries(metrics)) {
    const value = numberOrNull(rawValue);
    if (value !== null) {
      points.push({ metricName, value, labels, timestamp });
    }
  }

  return points;
};

async function upsertMetricAggregate(input: {
  organizationId: string | null;
  projectId: string | null;
  serviceId: string | null;
  projectKey: string | null;
  serviceName: string;
  environment: string;
  point: MetricPoint;
}) {
  for (const window of aggregateWindows) {
    const bucket = bucketFor(input.point.timestamp, window.ms);
    await db.query(
      `
      INSERT INTO metric_aggregates (
        id,
        organization_id,
        project_id,
        service_id,
        project_key,
        service_name,
        environment,
        metric_name,
        "window",
        timestamp_bucket,
        count,
        sum,
        avg,
        min,
        max,
        p50,
        p95,
        p99
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1, $11, $11, $11, $11, $11, $11, $11)
      ON CONFLICT (organization_id, project_id, service_id, environment, metric_name, "window", timestamp_bucket)
      DO UPDATE SET
        count = metric_aggregates.count + 1,
        sum = metric_aggregates.sum + excluded.sum,
        avg = (metric_aggregates.sum + excluded.sum) / (metric_aggregates.count + 1),
        min = LEAST(metric_aggregates.min, excluded.min),
        max = GREATEST(metric_aggregates.max, excluded.max),
        p50 = (metric_aggregates.sum + excluded.sum) / (metric_aggregates.count + 1),
        p95 = GREATEST(metric_aggregates.p95, excluded.p95),
        p99 = GREATEST(metric_aggregates.p99, excluded.p99),
        project_key = COALESCE(excluded.project_key, metric_aggregates.project_key),
        service_name = excluded.service_name,
        updated_at = now()
      `,
      [
        crypto.randomUUID(),
        input.organizationId,
        input.projectId,
        input.serviceId,
        input.projectKey,
        input.serviceName,
        input.environment,
        input.point.metricName,
        window.name,
        bucket,
        input.point.value
      ]
    );
  }
}

async function saveMetricToDb(payload: AegisOpsEvent) {
  const points = metricPointsFromPayload(payload);
  if (points.length === 0) {
    logger.debug({ payload }, "Metrics event had no numeric metric points");
    return;
  }

  const organizationId = uuidOrNull(payload.organizationId);
  const projectId = uuidOrNull(payload.projectId);
  const serviceId = uuidOrNull(payload.serviceId);
  const projectKey = stringOrNull(payload.projectKey);
  const serviceName = stringOrNull(payload.serviceName) ?? "unknown-service";
  const environment = stringOrNull(payload.environment) ?? "production";

  for (const point of points) {
    try {
      await db.query(
        `
        INSERT INTO metrics (
          id,
          organization_id,
          project_id,
          service_id,
          project_key,
          service_name,
          environment,
          metric_name,
          value,
          labels,
          timestamp
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `,
        [
          crypto.randomUUID(),
          organizationId,
          projectId,
          serviceId,
          projectKey,
          serviceName,
          environment,
          point.metricName,
          point.value,
          JSON.stringify(point.labels),
          point.timestamp
        ]
      );
      await upsertMetricAggregate({
        organizationId,
        projectId,
        serviceId,
        projectKey,
        serviceName,
        environment,
        point
      });
    } catch (error) {
      logger.error({ error, payload, metricName: point.metricName }, "Failed to write metric to PostgreSQL");
    }
  }
}

async function evaluateLogAlertRules(payload: AegisOpsEvent) {
  if (!payload.organizationId) {
    return;
  }

  const response = await fetch(`${env.CORE_API_URL.replace(/\/$/, "")}/api/alert-rules/evaluate-log`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      organizationId: payload.organizationId,
      projectId: payload.projectId,
      serviceId: payload.serviceId,
      serviceName: payload.serviceName,
      environment: payload.environment,
      level: payload.level,
      message: payload.message,
      traceId: payload.traceId,
      requestId: payload.requestId,
      route: payload.route,
      statusCode: payload.statusCode,
      metadata: objectOrEmpty(payload.metadata),
      timestamp: payload.timestamp
    })
  });

  if (!response.ok) {
    throw new Error(`Core API log alert evaluation failed: ${response.status} ${await response.text()}`);
  }
}

async function updateServiceHealth(payload: AegisOpsEvent) {
  const status = stringOrNull(payload.status);
  if (!status) return;
  const normalized = status === "ok" || status === "operational" ? "healthy" : status;
  const serviceId = uuidOrNull(payload.serviceId);
  const serviceName = stringOrNull(payload.serviceName);

  if (serviceId) {
    await db.query("UPDATE services SET health_status = $2, updated_at = now() WHERE id = $1", [serviceId, normalized]);
    return;
  }
  if (serviceName) {
    await db.query(
      `
      UPDATE services
      SET health_status = $2,
          updated_at = now()
      WHERE name = $1
        AND ($3::uuid IS NULL OR organization_id = $3)
        AND ($4::uuid IS NULL OR project_id = $4)
      `,
      [serviceName, normalized, uuidOrNull(payload.organizationId), uuidOrNull(payload.projectId)]
    );
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
      await clearTelemetryCaches({
        organizationId: stringOrNull(payload.organizationId),
        projectId: uuidOrNull(payload.projectId),
        serviceId: uuidOrNull(payload.serviceId)
      });
      await publisher.publish("deployment.impact.analyze", task(sourceTopic, "deployment.impact.analyze", payload));
      return;

    case "deployment.impact.generated":
      await publishNotifications(sourceTopic, payload, publisher);
      return;

    case "logs.received":
      await saveLogToDb(payload);
      await evaluateLogAlertRules(payload).catch((error) => logger.error({ error, payload }, "Log alert evaluation failed"));
      return;

    case "metrics.received":
      await saveMetricToDb(payload);
      return;

    case "service.health.changed":
      await updateServiceHealth(payload);
      return;

    case "logs.enriched":
    case "metrics.aggregated":
    case "audit.events":
      logger.debug({ sourceTopic, serviceName: payload.serviceName }, "Telemetry event observed");
      return;

    default:
      logger.warn({ sourceTopic }, "No worker workflow registered for topic");
  }
}
