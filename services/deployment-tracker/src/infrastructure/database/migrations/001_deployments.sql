CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deployments (
  id UUID PRIMARY KEY,
  organization_id UUID,
  project_id UUID,
  service_id UUID,
  provider TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'development',
  version TEXT,
  commit_sha TEXT,
  author TEXT,
  repository_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  deployed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deployments_service_created ON deployments(service_id, created_at);
CREATE INDEX IF NOT EXISTS idx_deployments_provider_created ON deployments(provider, created_at);

