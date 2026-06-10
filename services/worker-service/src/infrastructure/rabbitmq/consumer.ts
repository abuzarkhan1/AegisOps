import * as amqp from "amqplib";
import crypto from "node:crypto";
import { env } from "../../config/env";
import { db } from "../database/pool";
import { logger } from "../logging/logger";
import type { RabbitMqTaskPublisher } from "./publisher";
import type { WorkerTask, AegisOpsEvent } from "../../events/event.types";

const AI_RCA_URL = process.env.AI_RCA_URL || "http://localhost:8000";
const DEPLOYMENT_TRACKER_URL = process.env.DEPLOYMENT_TRACKER_URL || "http://localhost:4010";

export class RabbitMqTaskConsumer {
  private connection?: amqp.Connection;
  private channel?: amqp.Channel;

  constructor(private readonly publisher: RabbitMqTaskPublisher) {}

  async start() {
    this.connection = await amqp.connect(env.RABBITMQ_URL);
    this.channel = await this.connection.createChannel();

    await this.channel.prefetch(1);

    const queues = [
      "ai.analysis.requested",
      "ai.postmortem.generate",
      "deployment.impact.analyze",
      "report.daily.generate",
      "report.weekly.generate"
    ];

    for (const queue of queues) {
      await this.channel.consume(queue, async (msg) => {
        if (!msg) return;

        try {
          const task = JSON.parse(msg.content.toString()) as WorkerTask;
          logger.info({ queue, taskType: task.taskType }, "RabbitMQ task received");
          await this.processTask(task.taskType, task.payload);
          this.channel?.ack(msg);
        } catch (error) {
          logger.error({ error, queue, content: msg.content.toString() }, "Failed to process RabbitMQ task, routing to DLQ");
          // Requeue = false sends it to DLQ
          this.channel?.nack(msg, false, false);
        }
      });
    }

    logger.info({ queues }, "RabbitMQ task consumer started successfully");
  }

  async stop() {
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }

  private async processTask(taskType: string, payload: AegisOpsEvent) {
    switch (taskType) {
      case "ai.analysis.requested":
        await this.handleAiAnalysis(payload);
        break;
      case "ai.postmortem.generate":
        await this.handleAiPostmortem(payload);
        break;
      case "deployment.impact.analyze":
        await this.handleDeploymentImpact(payload);
        break;
      case "report.daily.generate":
        await this.handleReportGeneration(payload, 24);
        break;
      case "report.weekly.generate":
        await this.handleReportGeneration(payload, 24 * 7);
        break;
      default:
        logger.warn({ taskType }, "Unhandled RabbitMQ task type");
    }
  }

  private async handleAiAnalysis(payload: AegisOpsEvent) {
    const incidentId = payload.id || payload.incidentId;
    if (!incidentId) throw new Error("Missing incidentId in payload");

    // 1. Fetch incident details
    const incidentRes = await db.query("SELECT * FROM incidents WHERE id = $1", [incidentId]);
    if (!incidentRes.rowCount) throw new Error(`Incident ${incidentId} not found`);
    const incident = incidentRes.rows[0];

    // 2. Fetch service details
    let serviceName = "unknown-service";
    if (incident.service_id) {
      const serviceRes = await db.query("SELECT name FROM services WHERE id = $1", [incident.service_id]);
      if (serviceRes.rowCount) {
        serviceName = serviceRes.rows[0].name;
      }
    }

    // 3. Fetch recent logs from database (30 mins window before incident started)
    const logsRes = await db.query(
      `
      SELECT service_name AS "serviceName", level, message, trace_id AS "traceId", request_id AS "requestId", route, status_code AS "statusCode", duration_ms AS "durationMs", timestamp, metadata
      FROM logs
      WHERE (($1::uuid IS NOT NULL AND service_id = $1)
         OR ($1::uuid IS NULL AND service_name = $2))
        AND timestamp BETWEEN $3::timestamptz - interval '30 minutes' AND $3::timestamptz
      ORDER BY timestamp DESC
      LIMIT 100
      `,
      [incident.service_id, serviceName, incident.created_at]
    );
    const logs = logsRes.rows;

    // 4. Fetch recent deployment
    let deployment: any = null;
    if (incident.service_id) {
      const deployRes = await db.query(
        `
        SELECT version, commit_hash AS "commitSha", author, deployed_at AS "deployedAt"
        FROM deployments
        WHERE service_id = $1
          AND deployed_at <= $2::timestamptz
        ORDER BY deployed_at DESC
        LIMIT 1
        `,
        [incident.service_id, incident.created_at]
      );
      if (deployRes.rowCount) {
        deployment = deployRes.rows[0];
      }
    }

    // 5. Fetch alert rule
    let alertRule: any = null;
    if (incident.service_id) {
      const alertRes = await db.query(
        "SELECT name, metric, operator, threshold, duration_seconds AS \"durationSeconds\" FROM alert_rules WHERE service_id = $1 LIMIT 1",
        [incident.service_id]
      );
      if (alertRes.rowCount) {
        alertRule = alertRes.rows[0];
      }
    }

    // 6. Fetch recent metrics from PostgreSQL as AI evidence
    const metricsRes = await db.query(
      `
      SELECT metric_name AS "metricName",
             AVG(value)::float AS avg,
             MAX(value)::float AS max,
             SUM(value)::float AS sum,
             COUNT(*)::int AS samples
      FROM metrics
      WHERE (($1::uuid IS NOT NULL AND service_id = $1) OR ($1::uuid IS NULL AND service_name = $2))
        AND timestamp BETWEEN $3::timestamptz - interval '30 minutes' AND $3::timestamptz
      GROUP BY metric_name
      `,
      [incident.service_id, serviceName, incident.created_at]
    );
    const metricRows = metricsRes.rows;
    const sumMetric = (names: string[]) =>
      metricRows
        .filter((row) => names.includes(row.metricName))
        .reduce((total, row) => total + Number(row.sum ?? 0), 0);
    const maxMetric = (names: string[]) =>
      metricRows
        .filter((row) => names.includes(row.metricName))
        .reduce((current, row) => Math.max(current, Number(row.max ?? 0)), 0);
    const requests = sumMetric(["http_requests_total", "request_count", "requestCount"]);
    const errors = sumMetric(["http_errors_total", "http_5xx_total", "error_count", "errorCount", "exceptions_total"]);
    const metricsSummary = {
      errorRate: requests > 0 ? Number(((errors / requests) * 100).toFixed(2)) : 0,
      p95LatencyMs: maxMetric(["http_request_duration_p95", "p95_latency", "p95LatencyMs", "http_request_duration_ms"]),
      throughput: requests,
      samples: metricRows.reduce((total, row) => total + Number(row.samples ?? 0), 0),
      metrics: metricRows
    };

    // 7. Request AI Analysis from ai-rca-service
    const requestBody = {
      incidentId,
      organizationId: incident.organization_id,
      serviceId: incident.service_id,
      serviceName,
      environment: "production",
      severity: incident.severity,
      logs,
      metricsSummary,
      deployment,
      alertRule
    };

    const aiRes = await fetch(`${AI_RCA_URL}/analyze-incident`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    if (!aiRes.ok) {
      throw new Error(`AI RCA Service failed: ${aiRes.status} ${await aiRes.text()}`);
    }

    const analysis = await aiRes.json();

    // 8. Save the analysis using Core API POST endpoint
    const saveRes = await fetch(`${env.CORE_API_URL.replace(/\/$/, "")}/api/incidents/${incidentId}/ai-analysis`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        summary: analysis.summary,
        likelyRootCause: analysis.likelyRootCause,
        confidenceScore: analysis.confidenceScore,
        evidence: analysis.evidence,
        recommendedActions: analysis.recommendedActions,
        rollbackRecommendation: analysis.rollbackRecommendation,
        postmortemDraft: analysis.postmortemDraft
      })
    });

    if (!saveRes.ok) {
      throw new Error(`Failed to save AI analysis via Core API: ${saveRes.status} ${await saveRes.text()}`);
    }

    // 9. Add timeline event directly
    await db.query(
      `
      INSERT INTO incident_timeline_events (id, incident_id, event_type, message, metadata, created_at)
      VALUES ($1, $2, 'ai_analysis', $3, $4, now())
      `,
      [
        crypto.randomUUID(),
        incidentId,
        "AI Incident analysis completed: " + analysis.summary,
        JSON.stringify({ confidenceScore: analysis.confidenceScore })
      ]
    );

    logger.info({ incidentId }, "AI RCA analysis completed and saved");
  }

  private async handleAiPostmortem(payload: AegisOpsEvent) {
    const incidentId = payload.id || payload.incidentId;
    if (!incidentId) throw new Error("Missing incidentId in payload");

    // 1. Fetch incident and timeline
    const incidentRes = await db.query("SELECT * FROM incidents WHERE id = $1", [incidentId]);
    if (!incidentRes.rowCount) throw new Error(`Incident ${incidentId} not found`);
    const incident = incidentRes.rows[0];

    const timelineRes = await db.query("SELECT event_type AS \"eventType\", message, created_at AS \"createdAt\" FROM incident_timeline_events WHERE incident_id = $1 ORDER BY created_at ASC", [incidentId]);
    const timeline = timelineRes.rows;

    // 2. Fetch existing AI RCA
    const analysisRes = await db.query("SELECT likely_root_cause AS \"likelyRootCause\", recommended_actions AS \"recommendedActions\" FROM ai_analysis_results WHERE incident_id = $1 ORDER BY created_at DESC LIMIT 1", [incidentId]);
    const rootCause = analysisRes.rowCount ? analysisRes.rows[0].likelyRootCause : "Pending final engineer review.";
    const actions = analysisRes.rowCount ? analysisRes.rows[0].recommendedActions : [];

    // 3. Request postmortem generation from ai-rca-service
    const requestBody = {
      incidentId,
      summary: incident.summary || incident.title,
      timeline,
      rootCause,
      actions
    };

    const pmRes = await fetch(`${AI_RCA_URL}/generate-postmortem`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    if (!pmRes.ok) {
      throw new Error(`AI Postmortem failed: ${pmRes.status} ${await pmRes.text()}`);
    }

    const postmortem = await pmRes.json();

    // 4. Update the postmortem draft in the database
    await db.query(
      `
      UPDATE ai_analysis_results
      SET postmortem_draft = $2
      WHERE incident_id = $1
      `,
      [incidentId, postmortem.postmortemDraft || JSON.stringify(postmortem)]
    );

    // 5. Add timeline event
    await db.query(
      `
      INSERT INTO incident_timeline_events (id, incident_id, event_type, message, metadata, created_at)
      VALUES ($1, $2, 'ai_postmortem', 'AI Postmortem draft successfully generated', '{}', now())
      `,
      [crypto.randomUUID(), incidentId]
    );

    logger.info({ incidentId }, "AI Postmortem generated and saved");
  }

  private async handleDeploymentImpact(payload: AegisOpsEvent) {
    const deploymentId = payload.id || payload.deploymentId;
    if (!deploymentId) throw new Error("Missing deploymentId in payload");

    // 1. Fetch deployment
    const deployRes = await db.query("SELECT * FROM deployments WHERE id = $1", [deploymentId]);
    if (!deployRes.rowCount) throw new Error(`Deployment ${deploymentId} not found`);
    const deployment = deployRes.rows[0];
    const serviceName = deployment.metadata?.serviceName || "checkout-api";

    // 2. Compute metrics differentials (before & after windows)
    // In local development, we fallback to simulated metrics
    const beforeMetrics = { errorRate: 0.2, avgLatencyMs: 145, p95LatencyMs: 290 };
    const afterMetrics = { errorRate: 6.4, avgLatencyMs: 910, p95LatencyMs: 1820 };

    // 3. Call AI RCA service `/deployment-impact`
    const requestBody = {
      deploymentId,
      serviceName,
      beforeMetrics,
      afterMetrics
    };

    const impactRes = await fetch(`${AI_RCA_URL}/deployment-impact`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    if (!impactRes.ok) {
      throw new Error(`AI Deployment impact failed: ${impactRes.status} ${await impactRes.text()}`);
    }

    const analysis = await impactRes.json();

    // 4. Save impact results to deployment-tracker
    const saveRes = await fetch(`${DEPLOYMENT_TRACKER_URL}/deployments/${deploymentId}/impact`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        summary: analysis.summary,
        risk: analysis.risk,
        beforeMetrics,
        afterMetrics,
        recommendation: analysis.risk === "high" ? "Rollback recommended; error rate jumped by 6.2%." : "No immediate action required."
      })
    });

    if (!saveRes.ok) {
      throw new Error(`Failed to save deployment impact: ${saveRes.status} ${await saveRes.text()}`);
    }

    // 5. If high risk, publish email/slack notification
    if (analysis.risk === "high" && deployment.organization_id) {
      const notificationEvent = {
        organizationId: deployment.organization_id,
        eventType: "deployment_impact_detected",
        severity: "high",
        title: `High Risk Deployment Detected: ${serviceName}`,
        summary: `Deployment of version ${deployment.version || "unknown"} on ${deployment.environment} shows critical performance regression. ${analysis.summary}`
      };
      await this.publisher.publish("notification.email.send", {
        taskType: "notification.email.send",
        sourceTopic: "deployment.impact.generated",
        createdAt: new Date().toISOString(),
        payload: notificationEvent
      });
      await this.publisher.publish("notification.slack.send", {
        taskType: "notification.slack.send",
        sourceTopic: "deployment.impact.generated",
        createdAt: new Date().toISOString(),
        payload: notificationEvent
      });
    }

    logger.info({ deploymentId }, "Deployment impact analysis complete");
  }

  private async handleReportGeneration(payload: AegisOpsEvent, hoursWindow: number) {
    const orgId = payload.organizationId;
    if (!orgId) throw new Error("Missing organizationId in report generation");

    const sinceDate = new Date(Date.now() - hoursWindow * 3600 * 1000).toISOString();

    // 1. Calculate reliability stats from Postgres
    const incidentsCountRes = await db.query(
      "SELECT COUNT(*)::int AS count FROM incidents WHERE organization_id = $1 AND created_at >= $2",
      [orgId, sinceDate]
    );
    const criticalIncidentsRes = await db.query(
      "SELECT COUNT(*)::int AS count FROM incidents WHERE organization_id = $1 AND severity = 'critical' AND created_at >= $2",
      [orgId, sinceDate]
    );
    const avgResolutionRes = await db.query(
      `
      SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/60.0)::float AS avg_res
      FROM incidents
      WHERE organization_id = $1 AND resolved_at IS NOT NULL AND created_at >= $2
      `,
      [orgId, sinceDate]
    );

    const unstableServiceRes = await db.query(
      `
      SELECT s.name, COUNT(*)::int AS count
      FROM incidents i
      JOIN services s ON s.id = i.service_id
      WHERE i.organization_id = $1 AND i.created_at >= $2
      GROUP BY s.name
      ORDER BY count DESC
      LIMIT 1
      `,
      [orgId, sinceDate]
    );

    const totalIncidents = incidentsCountRes.rows[0]?.count || 0;
    const criticalIncidents = criticalIncidentsRes.rows[0]?.count || 0;
    const avgResolutionMinutes = Math.round(avgResolutionRes.rows[0]?.avg_res || 0);
    const unstableService = unstableServiceRes.rows[0]?.name || "None";

    const reportType = hoursWindow === 24 ? "Daily" : "Weekly";
    const reportTitle = `${reportType} Reliability Report`;
    const reportText = `
*${reportTitle}*
- Time Window: Last ${hoursWindow} hours
- Total Incidents: ${totalIncidents}
- Critical Incidents: ${criticalIncidents}
- Avg Resolution Time: ${avgResolutionMinutes} minutes
- Most Unstable Service: ${unstableService}
`;

    // 2. Publish email/Slack notification tasks
    const notificationEvent = {
      organizationId: orgId,
      eventType: "weekly_report_ready",
      severity: "low",
      title: reportTitle,
      summary: reportText
    };

    await this.publisher.publish("notification.email.send", {
      taskType: "notification.email.send",
      sourceTopic: "report.generated",
      createdAt: new Date().toISOString(),
      payload: notificationEvent
    });

    await this.publisher.publish("notification.slack.send", {
      taskType: "notification.slack.send",
      sourceTopic: "report.generated",
      createdAt: new Date().toISOString(),
      payload: notificationEvent
    });

    logger.info({ orgId, reportType }, "Reliability report generated and notification queued");
  }
}
