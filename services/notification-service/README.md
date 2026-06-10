# Notification Service

Java Spring Boot service for future notification and escalation workflows.

Current foundation endpoints:

- `GET /health`
- `GET /actuator/health`
- `GET /actuator/prometheus`
- `POST /notifications/test`

RabbitMQ, PostgreSQL, and Redis configuration is surfaced as placeholder wiring for the next implementation phase.

