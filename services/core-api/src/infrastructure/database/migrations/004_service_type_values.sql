ALTER TABLE services
  DROP CONSTRAINT IF EXISTS services_service_type_check;

ALTER TABLE services
  ADD CONSTRAINT services_service_type_check
  CHECK (service_type IN ('api', 'frontend', 'worker', 'database', 'db', 'queue', 'cache', 'external'));
