# Notification Service

Java Spring Boot service for notification and escalation workflows.

Current foundation endpoints:

- `GET /health`
- `GET /actuator/health`
- `GET /actuator/prometheus`
- `POST /notifications/test`
- `GET /notify/settings/:orgId`
- `PATCH /notify/settings/:orgId`
- `GET /notify/history`
- `POST /notify/email`
- `POST /notify/slack`
- `POST /notify/discord`
- `/notify/escalation-policies`

The service consumes RabbitMQ notification and escalation queues, stores local notification settings/history, supports email, Slack, and Discord mock providers for local development, and exposes actuator health/Prometheus metrics.
