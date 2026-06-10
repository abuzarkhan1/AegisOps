# Deployment Tracker

Node.js Express TypeScript service for deployment webhook intake.

Current foundation endpoints:

- `GET /health`
- `GET /metrics`
- `POST /webhooks/github`

Deployment events are published to Kafka topic `deployments.created`.

