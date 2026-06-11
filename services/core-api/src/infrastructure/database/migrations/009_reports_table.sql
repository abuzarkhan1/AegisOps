CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  report_type TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'generated',
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_org_created ON reports(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_org_type_created ON reports(organization_id, report_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_project_created ON reports(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_service_created ON reports(service_id, created_at DESC);
