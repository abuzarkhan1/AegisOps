# AegisOps Local Development Runbook

This guide covers starting, developing, and validating the AegisOps stack locally.

## Prerequisite Installation

Make sure the following are installed locally:
- Docker and Docker Compose
- Node.js LTS and npm
- Go
- Python 3
- Java LTS and Maven

## Start Shared Infrastructure

Shared infrastructure components (PostgreSQL, Redis, RabbitMQ, Kafka, Prometheus, Grafana, Nginx) run inside Docker:

```bash
# Verify docker compose config
docker compose config --quiet

# Start all containers in detached mode
docker compose up -d

# Verify all containers are healthy
docker compose ps
```

## Start Application Services

Run the application services locally on your host machine to allow rapid development and debugging:

```bash
# Run the core services orchestrator script
./start_services.sh
```

To stop all background service processes:
```bash
./stop_services.sh
```

To stop both host application services and shared Docker infrastructure:
```bash
./stop_services.sh --with-infra
```

The start script skips a host service when its port is already in use, so running it twice will not create duplicate processes for the same local port.

## Database Connection & Verification

PostgreSQL details:
- Host: `localhost`
- Port: `5432`
- Database: `aegisops`
- User: `aegisops`
- Password: `aegisops`

Redis details:
- Host: `localhost`
- Port: `6379`

RabbitMQ Management Console:
- URL: [http://localhost:15672](http://localhost:15672)
- Username: `aegisops`
- Password: `aegisops`

## Run Validation Tests

Ensure everything works correctly before checking in:

```bash
# Run the local smoke test suite
./scripts/smoke-test.sh
```

Retention defaults are configured through `.env.example` and can be overridden per environment:

- `LOG_RETENTION_DAYS`
- `RAW_METRIC_RETENTION_DAYS`
- `AGGREGATE_METRIC_RETENTION_DAYS`
- `AUDIT_LOG_RETENTION_DAYS`
- `INCIDENT_EVENT_RETENTION_DAYS`
