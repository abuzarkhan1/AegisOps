# Core API

Node.js Express TypeScript service for AegisOps business APIs.

Current foundation endpoints:

- `GET /health`
- `GET /metrics`
- `GET /api/v1/info`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `/api/organizations`
- `/api/projects`
- `/api/projects/:projectId/services`
- `/api/services/:serviceId`
- `/api/services/:serviceId/api-keys`
- `/api/alert-rules`
- `POST /api/alert-rules/evaluate`
- `/api/incidents`
- `/api/incidents/:incidentId/timeline`
- `/api/incidents/:incidentId/ai-analysis`
- `/api/dashboard/*`
- `GET /api/logs`
- `GET /api/audit-logs`

The service owns the product data model, Redis-backed cache/rate-limit paths, API-key validation, alert evaluation, incident creation, timeline events, AI analysis persistence, Kafka incident publishing, dashboard summaries, audit logs, and PostgreSQL-backed log search.
