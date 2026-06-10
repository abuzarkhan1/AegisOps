# Core API

Node.js Express TypeScript service for AegisOps business APIs.

Current foundation endpoints:

- `GET /health`
- `GET /metrics`
- `GET /api/v1/info`

The first pass validates environment config and exposes dependency checks for PostgreSQL, Redis, Kafka, and RabbitMQ. Product modules are placeholders for future implementation.

