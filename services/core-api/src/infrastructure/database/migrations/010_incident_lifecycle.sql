ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_status_check;

ALTER TABLE incidents
  ADD CONSTRAINT incidents_status_check
  CHECK (status IN ('open', 'investigating', 'identified', 'monitoring', 'resolved', 'closed'));

CREATE INDEX IF NOT EXISTS idx_incident_evidence_incident_type
  ON incident_evidence(incident_id, evidence_type, created_at DESC);
