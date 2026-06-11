ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS project_type TEXT NOT NULL DEFAULT 'monolith',
  ADD COLUMN IF NOT EXISTS repository_url TEXT,
  ADD COLUMN IF NOT EXISTS owner_team TEXT;

ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_project_type_check;

ALTER TABLE projects
  ADD CONSTRAINT projects_project_type_check
  CHECK (project_type IN ('monolith', 'microservices', 'worker-queue', 'frontend', 'hybrid'));

CREATE INDEX IF NOT EXISTS idx_projects_org_project_type ON projects(organization_id, project_type);

ALTER TABLE services
  DROP CONSTRAINT IF EXISTS services_service_type_check;

ALTER TABLE services
  ADD CONSTRAINT services_service_type_check
  CHECK (service_type IN ('api', 'frontend', 'worker', 'database', 'db', 'queue', 'cache', 'message-broker', 'external', 'external-api'));
