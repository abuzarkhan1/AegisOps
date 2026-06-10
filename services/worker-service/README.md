# Worker Service

Node.js TypeScript orchestration worker for future incident and report workflows.

Current foundation endpoints:

- `GET /health`

The worker validates connectivity to PostgreSQL, Redis, Kafka, and RabbitMQ. Actual consumers/producers are documented placeholders for the next phase.

