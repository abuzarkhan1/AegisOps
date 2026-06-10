CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS project_key TEXT;

UPDATE projects
SET project_key = trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')) || '-' || left(id::text, 8)
WHERE project_key IS NULL OR project_key = '';

ALTER TABLE projects
  ALTER COLUMN project_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_org_project_key ON projects(organization_id, project_key);

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'production';

UPDATE services s
SET environment = COALESCE(NULLIF(s.environment, ''), p.environment, 'production')
FROM projects p
WHERE s.project_id = p.id;

CREATE TABLE IF NOT EXISTS environments (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'operational',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, name)
);

INSERT INTO environments (id, organization_id, project_id, name)
SELECT gen_random_uuid(), organization_id, id, environment
FROM projects
ON CONFLICT (project_id, name) DO NOTHING;

ALTER TABLE logs
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_key TEXT,
  ADD COLUMN IF NOT EXISTS request_id TEXT,
  ADD COLUMN IF NOT EXISTS span_id TEXT,
  ADD COLUMN IF NOT EXISTS parent_span_id TEXT,
  ADD COLUMN IF NOT EXISTS route TEXT,
  ADD COLUMN IF NOT EXISTS method TEXT,
  ADD COLUMN IF NOT EXISTS status_code INTEGER,
  ADD COLUMN IF NOT EXISTS duration_ms DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_logs_org_project_service_timestamp ON logs(organization_id, project_id, service_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_project_key_timestamp ON logs(project_key, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_request_id ON logs(request_id);
CREATE INDEX IF NOT EXISTS idx_logs_route_timestamp ON logs(route, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_status_code_timestamp ON logs(status_code, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_metadata_gin ON logs USING GIN(metadata);

CREATE TABLE IF NOT EXISTS metrics (
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

CREATE INDEX IF NOT EXISTS idx_metrics_org_project_service_timestamp ON metrics(organization_id, project_id, service_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_metric_name_timestamp ON metrics(metric_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_environment_timestamp ON metrics(environment, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_project_key_timestamp ON metrics(project_key, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_labels_gin ON metrics USING GIN(labels);

CREATE TABLE IF NOT EXISTS metric_aggregates (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  project_key TEXT,
  service_name TEXT NOT NULL,
  environment TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  "window" TEXT NOT NULL,
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_metric_aggregates_unique
  ON metric_aggregates(organization_id, project_id, service_id, environment, metric_name, "window", timestamp_bucket)
  NULLS NOT DISTINCT;
CREATE INDEX IF NOT EXISTS idx_metric_aggregates_lookup ON metric_aggregates(organization_id, project_id, service_id, metric_name, "window", timestamp_bucket DESC);

CREATE TABLE IF NOT EXISTS incident_events (
  id UUID PRIMARY KEY,
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incident_evidence (
  id UUID PRIMARY KEY,
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL,
  source_id UUID,
  title TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incident_evidence_incident ON incident_evidence(incident_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_rca_reports (
  id UUID PRIMARY KEY,
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  likely_root_cause TEXT NOT NULL,
  confidence_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  rollback_recommendation TEXT,
  postmortem_draft TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deployment_impacts (
  id UUID PRIMARY KEY,
  deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  environment TEXT,
  before_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary TEXT,
  risk TEXT,
  recommendation TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(deployment_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  destination TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_history (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  subject TEXT,
  destination TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_history_org_created ON notification_history(organization_id, created_at DESC);
