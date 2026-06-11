# Audit Logs

AegisOps stores enterprise action history in PostgreSQL `audit_logs` and exposes it through:

- `GET /api/audit-logs`
- Dashboard page `/audit-logs`

Supported query filters:

- `organizationId`
- `actorId`
- `action`
- `resourceType`
- `resourceId`
- `status`
- `from`
- `to`
- `limit`

Audit records include timestamp, actor ID, organization ID, action, resource type, resource ID, derived status, derived IP address when metadata provides it, and metadata JSON.

Current audited workflows include project/service changes, API key changes, alert rule changes, incident lifecycle actions, incident evidence, and postmortem generation.
