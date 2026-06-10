ALTER TABLE users
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';

ALTER TABLE projects
  ALTER COLUMN environment SET DEFAULT 'dev';

UPDATE projects
SET environment = CASE environment
  WHEN 'development' THEN 'dev'
  WHEN 'production' THEN 'prod'
  ELSE environment
END
WHERE environment IN ('development', 'production');

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS service_type TEXT NOT NULL DEFAULT 'api';

ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

UPDATE api_keys
SET status = 'revoked'
WHERE revoked_at IS NOT NULL;

ALTER TABLE alert_rules
  ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id) ON DELETE SET NULL;

UPDATE alert_rules
SET operator = CASE operator
  WHEN '>' THEN 'gt'
  WHEN '<' THEN 'lt'
  WHEN '>=' THEN 'gte'
  WHEN '<=' THEN 'lte'
  WHEN '==' THEN 'eq'
  WHEN '=' THEN 'eq'
  ELSE operator
END;

CREATE INDEX IF NOT EXISTS idx_alert_rules_service_enabled ON alert_rules(service_id, enabled);

ALTER TABLE ai_analysis_results
  ADD COLUMN IF NOT EXISTS confidence_score DOUBLE PRECISION;

UPDATE ai_analysis_results
SET confidence_score = confidence
WHERE confidence_score IS NULL;

ALTER TABLE deployments
  ADD COLUMN IF NOT EXISTS repository TEXT,
  ADD COLUMN IF NOT EXISTS commit_hash TEXT,
  ADD COLUMN IF NOT EXISTS branch TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed';

UPDATE deployments
SET repository = COALESCE(repository, repository_url),
    commit_hash = COALESCE(commit_hash, commit_sha)
WHERE repository IS NULL OR commit_hash IS NULL;

ALTER TABLE notification_settings
  ADD COLUMN IF NOT EXISTS channel TEXT,
  ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE notification_settings
SET channel = COALESCE(channel, provider),
    config = CASE
      WHEN config = '{}'::jsonb THEN jsonb_build_object('destination', destination)
      ELSE config
    END;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_active ON refresh_tokens(user_id, expires_at)
WHERE revoked_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_status_check') THEN
    ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('active', 'inactive'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organizations_plan_check') THEN
    ALTER TABLE organizations ADD CONSTRAINT organizations_plan_check CHECK (plan IN ('free', 'pro', 'enterprise'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'services_service_type_check') THEN
    ALTER TABLE services ADD CONSTRAINT services_service_type_check CHECK (service_type IN ('api', 'frontend', 'worker', 'db', 'queue'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_status_check') THEN
    ALTER TABLE api_keys ADD CONSTRAINT api_keys_status_check CHECK (status IN ('active', 'revoked'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alert_rules_operator_check') THEN
    ALTER TABLE alert_rules ADD CONSTRAINT alert_rules_operator_check CHECK (operator IN ('gt', 'lt', 'gte', 'lte', 'eq'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'incidents_status_check') THEN
    ALTER TABLE incidents ADD CONSTRAINT incidents_status_check CHECK (status IN ('open', 'investigating', 'identified', 'monitoring', 'resolved'));
  END IF;
END
$$;
