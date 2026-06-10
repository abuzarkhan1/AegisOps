ALTER TABLE deployments
  ADD COLUMN IF NOT EXISTS repository TEXT,
  ADD COLUMN IF NOT EXISTS commit_hash TEXT,
  ADD COLUMN IF NOT EXISTS branch TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed';

UPDATE deployments
SET repository = COALESCE(repository, repository_url),
    commit_hash = COALESCE(commit_hash, commit_sha)
WHERE repository IS NULL OR commit_hash IS NULL;

CREATE INDEX IF NOT EXISTS idx_deployments_status_created ON deployments(status, created_at DESC);
