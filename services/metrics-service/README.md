# Metrics Service

Go service for custom metric intake.

Current foundation endpoints:

- `GET /health`
- `GET /metrics`
- `POST /metrics/custom`

Accepted custom metrics are published to Kafka topic `metrics.received`.

