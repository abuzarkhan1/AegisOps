# AegisOps — Implementation Plan (PostgreSQL Logs Storage Edition)

This plan details the implementation of the remaining AegisOps components. In accordance with requirements, **Elasticsearch, Kibana, and Fluent Bit are excluded**. Instead, a lightweight PostgreSQL-based telemetry storage model will be used.

---

## 1. System Architecture (Lightweight Local Model)

```text
               ┌─────────────────────┐
               │   React Dashboard   │
               └──────────┬──────────┘
                          │ (HTTP)
                          ▼
               ┌─────────────────────┐
               │   Nginx API Gateway │
               └──────────┬──────────┘
                          │ (HTTP)
            ┌─────────────┼─────────────┐
            ▼             ▼             ▼
   ┌──────────────┐ ┌───────────┐ ┌───────────┐
   │ Go Ingester  │ │ Core API  │ │ DeploySvc │
   └──────┬───────┘ └─────┬─────┘ └─────┬─────┘
          │ (Kafka)       │             │ (Postgres)
          ▼               │             │
   ┌──────────────┐       │             │
   │ Kafka Stream │       │             │
   └──────┬───────┘       │             │
          │ (Kafka)       ▼             │
          ▼         ┌───────────┐       │
   ┌──────────────┐ │           │       │
   │ Worker Svc   ├─►  Postgres ◄───────┘
   └──────┬───────┘ │  Database │
          │         └───────────┘
          ▼ (RabbitMQ)
   ┌──────────────┐
   │ AI / Notify  │
   └──────────────┘
```

---

## 2. Updated Implementation Phases

### Phase 1: Database Schema Updates
1. Create a `logs` table in PostgreSQL to store normalized log entries:
   - `id` (UUID)
   - `service_name` (TEXT)
   - `level` (TEXT)
   - `message` (TEXT)
   - `trace_id` (TEXT)
   - `environment` (TEXT)
   - `metadata` (JSONB)
   - `timestamp` (TIMESTAMPTZ)
   - `created_at` (TIMESTAMPTZ)
2. Add a database migration in `core-api` to create this table.

### Phase 2: Log Persistence via Kafka Consumer
1. Configure `worker-service` to consume from Kafka `logs.received`.
2. When a log event is consumed, write it directly to the PostgreSQL `logs` table.

### Phase 3: Core API Endpoints
1. Add `GET /api/logs` in `core-api` to support querying logs with filters (service name, level, environment, trace ID, search query).
2. Add `POST /api/incidents/:incidentId/ai-analysis` in `core-api` to save AI incident reports.
3. Add `POST /deployments/:deploymentId/impact` in `deployment-tracker` to save deployment impact results inside the JSONB `metadata` column.

### Phase 4: RabbitMQ Task Consumers in `worker-service`
Implement background handlers in `worker-service` for RabbitMQ tasks:
1. `ai.analysis.requested`:
   - Fetch incident details, alert rules, and related logs from PostgreSQL.
   - Call `ai-rca-service` at `/ai/analyze-incident`.
   - Save the analysis results using the Core API.
2. `ai.postmortem.generate`:
   - Retrieve incident details and timeline.
   - Call `ai-rca-service` at `/ai/generate-postmortem`.
   - Save the postmortem draft.
3. `deployment.impact.analyze`:
   - Retrieve deployment details.
   - Calculate latency and error rate metrics before/after the deployment timestamp (querying Prometheus or using mock differentials as a fallback).
   - Call `ai-rca-service` at `/ai/deployment-impact`.
   - Save the impact report to `deployment-tracker`.
4. `report.daily.generate` & `report.weekly.generate`:
   - Compute reliability stats from PostgreSQL.
   - Publish email/Slack notification tasks with the summary.

### Phase 5: Dashboard Enhancements
1. **Logs Explorer:** Query `GET /api/logs` to display log lists, filter by levels/services, and search messages.
2. **Incident Details:** Display incident timeline, metrics trends, AI RCA cards, rollback recommendations, and postmortem drafts.
3. **Deployment Impact:** Show deployment history and performance impact (latency/error change) details.
4. **Settings/Notifications:** Enable setting and checking notification destinations.
