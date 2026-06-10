# Worker Service

Node.js TypeScript orchestration worker for incident and report workflows.

Current foundation endpoints:

- `GET /health`

The worker consumes Kafka telemetry/domain topics, persists ingested logs to PostgreSQL, publishes RabbitMQ tasks for AI analysis, postmortems, deployment impact, notifications, reports, and escalation, and provisions durable failed queues through the dead-letter exchange.
