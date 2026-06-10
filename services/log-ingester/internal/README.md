# Internal Packages

The log ingester keeps implementation packages under `internal/` so future API-key validation, Kafka producers, transport handlers, and Prometheus metrics cannot be imported accidentally by other Go modules.

