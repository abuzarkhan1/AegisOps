# AegisOps — Implementation Plan (PostgreSQL Monitoring Storage Edition)

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
2. Add database migrations in `core-api` for logs, metrics, metric aggregates, incident evidence, AI RCA reports, deployment impacts, notifications, and notification history.

### Phase 2: Log Persistence via Kafka Consumer
1. Configure `worker-service` to consume from Kafka `logs.received` and `metrics.received`.
2. When a log event is consumed, write it directly to the PostgreSQL `logs` table.
3. When a metric event is consumed, write it to `metrics` and update 1m/5m/15m/1h/1d `metric_aggregates`.

### Phase 3: Core API Endpoints
1. Add `GET /api/logs` in `core-api` to support querying logs with filters (organization, project, service, level, environment, trace ID, request ID, route, status code, search query).
2. Add `GET /api/telemetry/metrics` and `GET /api/telemetry/metric-aggregates` for dashboard metric queries.
3. Add `POST /api/incidents/:incidentId/ai-analysis` in `core-api` to save AI incident reports.
4. Add `POST /deployments/:deploymentId/impact` in `deployment-tracker` to save deployment impact results to `deployment_impacts`.

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
   - Calculate latency and error rate metrics before/after the deployment timestamp from PostgreSQL metrics.
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
