# Log Ingester

Go service for high-volume log intake.

Current foundation endpoints:

- `GET /health`
- `GET /metrics`
- `POST /logs`

Accepted logs are published to Kafka topic `logs.received`.

