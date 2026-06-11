# AegisOps

AegisOps is an AI DevOps Incident Manager and SRE copilot foundation. The repository contains the production-style local orchestration layer plus service-owned implementations for auth, organizations, projects, services, API keys, incidents, deployments, log ingestion, metrics ingestion, AI RCA, worker orchestration, and notifications.

## Services

Application services:

- `nginx` API gateway
- `web-dashboard` React/Vite dashboard
- `core-api` Node.js/Express API
- `worker-service` Node.js worker orchestrator
- `log-ingester` Go log ingestion API
- `metrics-service` Go custom metrics API
- `ai-rca-service` Python/FastAPI RCA API
- `notification-service` Java/Spring Boot notification API
- `deployment-tracker` Node.js deployment webhook API

Infrastructure services:

- PostgreSQL
- Redis
- Kafka
- RabbitMQ
- Prometheus
- Grafana

Current local telemetry storage uses PostgreSQL for searchable logs, raw metrics, and aggregate metric buckets. Elasticsearch, Kibana, and Fluent Bit are not part of the active local architecture.

## Run Locally

Local development runs shared infrastructure in Docker and application services on host-installed runtimes. Compose does not build application images and does not use Go, Node.js, Python, Java, or MongoDB runtime containers.

```bash
cp .env.example .env
docker compose config
docker compose up -d
```

Install the local runtimes before starting application services:

```bash
brew install go python@3.12 openjdk@21 maven
source "$HOME/.nvm/nvm.sh" && nvm install --lts && nvm alias default "lts/*"
```

Then run the application services from their service folders:

```bash
cd services/core-api && npm install && npm run dev
cd services/worker-service && npm install && npm run dev
cd services/deployment-tracker && npm install && npm run dev
cd apps/web-dashboard && npm install && npm run dev
cd services/log-ingester && go run ./cmd/log-ingester
cd services/metrics-service && go run ./cmd/metrics-service
cd services/ai-rca-service && python3.12 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt && uvicorn app.main:app --host 0.0.0.0 --port 8000
cd services/notification-service && mvn spring-boot:run
```

Service Dockerfiles remain in the repo for production packaging, but local development does not build custom service images.

## Local URLs

| Component | URL |
| --- | --- |
| Gateway | http://localhost:8080 |
| Web Dashboard | http://localhost:5173 |
| Core API | http://localhost:4000 |
| Log Ingester | http://localhost:5001 |
| Metrics Service | http://localhost:5002 |
| AI RCA Service | http://localhost:8000 |
| Notification Service | http://localhost:8085 |
| Deployment Tracker | http://localhost:4010 |
| RabbitMQ UI | http://localhost:15672 |
| Kafka UI | http://localhost:8090 |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3000 |

Default local credentials:

- RabbitMQ: `aegisops` / `aegisops`
- Grafana: `admin` / `aegisops`
- PostgreSQL: `aegisops` / `aegisops`

## Health Checks

```bash
curl http://localhost:8080/health
curl http://localhost:4000/health
curl http://localhost:5001/health
curl http://localhost:5002/health
curl http://localhost:8000/health
curl http://localhost:8085/health
curl http://localhost:4010/health
curl http://localhost:9090/-/healthy
```

## Implemented Gateway Routes

| Route | Service |
| --- | --- |
| `/api/*`, `/api/openapi.json` | Core API |
| `/ingest/logs` and `/ingest/logs/batch` | Log Ingester |
| `/metrics-api/metrics/custom`, `/metrics-api/metrics/batch`, `/metrics-api/ingest`, `/metrics-api/health-snapshot`, `/metrics-api/services/:serviceId/summary` | Metrics Service |
| `/ai/analyze-incident`, `/ai/summarize-logs`, `/ai/generate-postmortem`, `/ai/deployment-impact` | AI RCA Service |
| `/notify/email`, `/notify/slack`, `/notify/discord`, `/notify/settings/:orgId`, `/notify/history` | Notification Service |
| `/deployments/*` | Deployment Tracker |

## Project Instrumentation SDKs

The Connect Project flow supports service-scoped ingestion through local SDK packages:

| Framework | Package | Guide |
| --- | --- | --- |
| Node.js Express | `packages/aegisops-node` | `docs/node-express-integration.md` |
| Python FastAPI | `packages/aegisops-python` | `docs/python-fastapi-integration.md` |
| Java Spring Boot / Servlet | `packages/aegisops-java` | `docs/java-spring-boot-integration.md` |
| Go `net/http` | `packages/aegisops-go` | `docs/go-http-integration.md` |

All SDKs are fail-safe by default: telemetry failures are retried and dropped without crashing the monitored app.

Example monitored apps:

- `examples/monolith-node-express`
- `examples/fastapi-service`
- `examples/go-http-service`
- `examples/springboot-service`

Reports and retention are documented in `docs/reports-and-retention.md`.
API key lifecycle operations are documented in `docs/api-key-management.md`.

## Validation

```bash
docker compose config --quiet
docker compose up -d
./start_services.sh
./scripts/smoke-test.sh
```

Seed demo projects and telemetry:

```bash
./scripts/seed-demo-data.sh
```

## Troubleshooting

- If host service ports (4000, 4010, 4020, 5001, 5002, 5173, 8000, 8085) are already in use, you can stop all existing instances of these services by running:
  ```bash
  ./stop_services.sh
  ```
- To also stop shared Docker infrastructure, run:
  ```bash
  ./stop_services.sh --with-infra
  ```
- If port `3000`, `5432`, `6379`, or another required port is already in use, stop the conflicting local service or adjust the compose port mapping.
- If Docker image pulls hang on macOS credential lookup, run `docker logout` or fix Docker Desktop keychain access before pulling public infrastructure images.
- Some application health endpoints can return `"status": "degraded"` while infrastructure is still warming up. The containers keep running and expose dependency details in the health response.
