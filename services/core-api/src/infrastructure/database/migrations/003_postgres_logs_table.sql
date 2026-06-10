CREATE TABLE IF NOT EXISTS logs (
  id UUID PRIMARY KEY,
  service_name TEXT NOT NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  trace_id TEXT,
  environment TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_logs_service_timestamp ON logs(service_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_trace_id ON logs(trace_id);
CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC);
