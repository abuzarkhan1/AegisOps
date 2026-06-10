# AegisOps Architecture Notes

The local foundation mirrors the PRD's production shape:

- Nginx is the single gateway on port `8080`.
- Application services expose direct local ports for development and gateway routes for integrated testing.
- Kafka is the high-volume event stream for logs, metrics, deployments, incidents, alerts, and audit events.
- RabbitMQ is reserved for reliable background work such as AI analysis, notifications, reports, escalations, and deployment impact analysis.
- PostgreSQL stores business data, searchable logs, raw metrics, metric aggregates, incident evidence, AI RCA reports, and deployment impacts in the local version.
- Redis stores organization cache, API key cache, rate-limit counters, and dashboard summaries.
- Prometheus scrapes service metrics and Grafana is provisioned with a Prometheus datasource.
- Local development runs application services on host-installed runtimes. Docker Compose starts only shared infrastructure and the gateway.

## Kafka Topics

- `logs.received`
- `logs.enriched`
- `metrics.received`
- `metrics.aggregated`
- `deployments.created`
- `deployments.completed`
- `deployment.impact.generated`
- `incidents.created`
- `incidents.updated`
- `incidents.resolved`
- `alerts.triggered`
- `service.health.changed`
- `audit.events`

Kafka is configured with auto topic creation enabled for local development.

## RabbitMQ Queues

- `ai.analysis.requested`
- `ai.postmortem.generate`
- `notification.email.send`
- `notification.slack.send`
- `notification.discord.send`
- `report.daily.generate`
- `report.weekly.generate`
- `incident.escalate`
- `deployment.impact.analyze`

The worker declares durable task queues with the `aegisops.dlx` dead-letter exchange. Notification consumers declare the notification and escalation queues with matching DLQ bindings.

## RabbitMQ Dead-Letter Queues

- `ai.analysis.failed`
- `ai.postmortem.failed`
- `notification.email.failed`
- `notification.slack.failed`
- `notification.discord.failed`
- `report.daily.failed`
- `report.weekly.failed`
- `incident.escalate.failed`
- `deployment.impact.failed`

## Redis Key Patterns

- `org:{orgId}:profile`
- `org:{orgId}:settings`
- `org:{orgId}:projects`
- `org:{orgId}:services`
- `org:{orgId}:alert-rules`
- `org:{orgId}:dashboard-summary`
- `org:{orgId}:recent-incidents`
- `org:{orgId}:api-key:{keyHash}`
- `user:{userId}:permissions`
- `service:{serviceId}:config`
- `deployment:{deploymentId}:impact`
- `incident:{incidentId}:summary`
- `metrics:{orgId}:{projectId}:{serviceId}:summary:{timeRange}`
- `logs:{orgId}:{projectId}:{serviceId}:recent`
- `rate-limit:{apiKey}:{minute}`
