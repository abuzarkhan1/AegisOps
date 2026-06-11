# Reports and Retention

## Reports

AegisOps reports are generated from PostgreSQL-backed telemetry and saved in the `reports` table.

Supported report types:

- `daily_reliability`
- `weekly_reliability`
- `incident_report`
- `sla_report`
- `service_health`
- `deployment_impact`
- `ai_postmortem`
- `project_monitoring`

API:

```http
GET /api/reports
GET /api/reports/:reportId
POST /api/reports/generate
```

Example:

```bash
curl -X POST http://localhost:4000/api/reports/generate \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "ORG_ID",
    "reportType": "weekly_reliability",
    "periodStart": "2026-06-04T00:00:00.000Z",
    "periodEnd": "2026-06-11T00:00:00.000Z"
  }'
```

Report payloads include reliability score, uptime, throughput, error rate, latency, incidents, deployments, slow routes, erroring services, AI RCA recommendations, and export placeholders.

## Retention

Retention is handled by the worker service and can be triggered manually:

```bash
curl -X POST http://localhost:4020/jobs/retention
```

Environment variables:

```env
LOG_RETENTION_DAYS=30
RAW_METRIC_RETENTION_DAYS=14
AGGREGATE_METRIC_RETENTION_DAYS=180
AUDIT_LOG_RETENTION_DAYS=365
INCIDENT_EVENT_RETENTION_DAYS=365
```

Retention deletes old logs, raw metrics, aggregates, audit logs, and incident events. Incidents are preserved by default.
