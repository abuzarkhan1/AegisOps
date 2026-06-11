# Metrics and Logs Database Schema

This document details the PostgreSQL schema for logs, raw metrics, metric aggregates, and data retention settings.

## Logs Schema

The `logs` table stores structured queryable service log events:

```sql
CREATE TABLE logs (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  project_key TEXT,
  service_name TEXT NOT NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  trace_id TEXT,
  request_id TEXT,
  span_id TEXT,
  parent_span_id TEXT,
  route TEXT,
  method TEXT,
  status_code INTEGER,
  duration_ms DOUBLE PRECISION,
  environment TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Raw Metrics Schema

```sql
CREATE TABLE metrics (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  project_key TEXT,
  service_name TEXT NOT NULL,
  environment TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  labels JSONB NOT NULL DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Metric Aggregates Schema

Aggregates are precomputed at 1m, 5m, 15m, 1h, and 1d windows:

```sql
CREATE TABLE metric_aggregates (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  project_key TEXT,
  service_name TEXT NOT NULL,
  environment TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  window TEXT NOT NULL, -- '1m', '5m', '15m', '1h', '1d'
  timestamp_bucket TIMESTAMPTZ NOT NULL,
  count BIGINT NOT NULL DEFAULT 0,
  sum DOUBLE PRECISION NOT NULL DEFAULT 0,
  avg DOUBLE PRECISION NOT NULL DEFAULT 0,
  min DOUBLE PRECISION NOT NULL DEFAULT 0,
  max DOUBLE PRECISION NOT NULL DEFAULT 0,
  p50 DOUBLE PRECISION NOT NULL DEFAULT 0,
  p95 DOUBLE PRECISION NOT NULL DEFAULT 0,
  p99 DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

The worker rollup job recomputes aggregate windows with PostgreSQL `percentile_cont`, making p50/p95/p99 accurate for the raw samples stored in PostgreSQL. The streaming aggregate path remains useful for immediate feedback, while the scheduled job is the corrected source of truth.

## Route Performance API

Route analytics are derived from `http_request_duration_ms` metric labels and, when no metric rows exist for a route/method, matching structured logs:

- `route`
- `method`
- `requestCount`
- `avgLatency`
- `p95Latency`
- `errorCount`
- `errorRate`
- `status2xx`, `status4xx`, `status5xx`
- `lastSeen`

## Data Retention Configuration

Retention cleanup is managed via the worker retention job using environment variables:

- `LOG_RETENTION_DAYS` (default `30`): Delete logs older than this.
- `RAW_METRIC_RETENTION_DAYS` (default `14`): Delete raw metrics older than this.
- `AGGREGATE_METRIC_RETENTION_DAYS` (default `180`): Retain aggregate buckets longer.
- `AUDIT_LOG_RETENTION_DAYS` (default `365`): Audit history retention.
- `INCIDENT_EVENT_RETENTION_DAYS` (default `365`): Incident events history retention.

Partitions migration is documented in `services/core-api/src/infrastructure/database/migrations/006_partitioning_plan.sql`.
