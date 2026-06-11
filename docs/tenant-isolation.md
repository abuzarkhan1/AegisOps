# Tenant Isolation and Auth Scoping

AegisOps enforces strict tenant isolation at both the query level and ingestion level to prevent any cross-organization data leakage.

## Organization Scoping Middleware

Every database query on the core platform routes must be bound to a valid `organization_id`. This is handled by the `requireOrganizationContext` middleware:

1. **Token Scoping**: If an Authorization Bearer token is provided, the user's organization memberships are checked. The request is bound to their primary organization. If they attempt to access another organization's ID, a `403 Forbidden` error is returned.
2. **Resource Scoping**: When a request contains a `projectId`, `serviceId`, or `incidentId`, the middleware queries the database to find the resource's owner organization, verifying ownership against the authenticated user. When both `projectId` and `serviceId` are present, it also verifies that the service belongs to that project.
3. **Local/Demo Fallback**: In local/demo mode (without auth headers), the system defaults to the seed/demo organization to ensure seamless developer testing.

## Ingestion Isolation

API key ingestion endpoints in Go services (`log-ingester` and `metrics-service`) resolve their context via the `/api/api-keys/validate` endpoint:

- During validation, the core-api compares the target `projectKey` / `projectId` and `serviceName` / `serviceId` from the client's payload against the owner organization of the API key.
- Service-scoped API keys can only ingest for their bound service and project.
- Organization-scoped API keys must resolve the requested project/service inside the same organization before telemetry is accepted.
- If the API key belongs to Organization A, but the payload attempts to write to a project/service of Organization B, validation fails, and the ingestion request is rejected with `401 Unauthorized`.
