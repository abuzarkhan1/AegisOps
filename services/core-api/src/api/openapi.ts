export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "AegisOps Core API",
    version: "0.1.0",
    description: "Core business API for auth, organizations, projects, services, incidents, alert rules, API keys, dashboards, and audit logs."
  },
  servers: [{ url: "/api" }],
  paths: {
    "/auth/register": { post: { tags: ["Auth"], summary: "Register a user and organization" } },
    "/auth/login": { post: { tags: ["Auth"], summary: "Login with email and password" } },
    "/auth/refresh": { post: { tags: ["Auth"], summary: "Refresh the current bearer token" } },
    "/auth/logout": { post: { tags: ["Auth"], summary: "Logout current session" } },
    "/auth/me": { get: { tags: ["Auth"], summary: "Read current user" } },
    "/organizations": {
      get: { tags: ["Organizations"], summary: "List organizations" },
      post: { tags: ["Organizations"], summary: "Create organization" }
    },
    "/organizations/{orgId}": {
      get: { tags: ["Organizations"], summary: "Get organization" },
      patch: { tags: ["Organizations"], summary: "Update organization" }
    },
    "/organizations/{orgId}/users": { get: { tags: ["Organizations"], summary: "List organization members" } },
    "/organizations/{orgId}/users/invite": { post: { tags: ["Organizations"], summary: "Invite organization member" } },
    "/organizations/{orgId}/users/{userId}/role": { patch: { tags: ["Organizations"], summary: "Update member role" } },
    "/organizations/{orgId}/users/{userId}": { delete: { tags: ["Organizations"], summary: "Remove member" } },
    "/projects": {
      get: { tags: ["Projects"], summary: "List projects" },
      post: { tags: ["Projects"], summary: "Create project" }
    },
    "/projects/{projectId}": {
      get: { tags: ["Projects"], summary: "Get project" },
      patch: { tags: ["Projects"], summary: "Update project" },
      delete: { tags: ["Projects"], summary: "Delete project" }
    },
    "/projects/{projectId}/services": {
      get: { tags: ["Services"], summary: "List project services" },
      post: { tags: ["Services"], summary: "Create service" }
    },
    "/services/{serviceId}": {
      get: { tags: ["Services"], summary: "Get service" },
      patch: { tags: ["Services"], summary: "Update service" },
      delete: { tags: ["Services"], summary: "Delete service" }
    },
    "/services/{serviceId}/api-keys": {
      get: { tags: ["API Keys"], summary: "List service API keys" },
      post: { tags: ["API Keys"], summary: "Create service API key" }
    },
    "/api-keys": {
      get: { tags: ["API Keys"], summary: "List API keys" },
      post: { tags: ["API Keys"], summary: "Create API key" }
    },
    "/api-keys/validate": { post: { tags: ["API Keys"], summary: "Validate raw API key" } },
    "/api-keys/{apiKeyId}": { delete: { tags: ["API Keys"], summary: "Revoke API key" } },
    "/incidents": {
      get: { tags: ["Incidents"], summary: "List incidents" },
      post: { tags: ["Incidents"], summary: "Create incident" }
    },
    "/incidents/{incidentId}": {
      get: { tags: ["Incidents"], summary: "Get incident" },
      patch: { tags: ["Incidents"], summary: "Update incident" }
    },
    "/incidents/{incidentId}/assign": { post: { tags: ["Incidents"], summary: "Assign incident" } },
    "/incidents/{incidentId}/resolve": { post: { tags: ["Incidents"], summary: "Resolve incident" } },
    "/incidents/{incidentId}/timeline": { get: { tags: ["Incidents"], summary: "List incident timeline" } },
    "/incidents/{incidentId}/ai-analysis": {
      get: { tags: ["Incidents"], summary: "List incident AI analysis" },
      post: { tags: ["Incidents"], summary: "Persist generated incident AI analysis" }
    },
    "/alert-rules": {
      get: { tags: ["Alert Rules"], summary: "List alert rules" },
      post: { tags: ["Alert Rules"], summary: "Create alert rule" }
    },
    "/alert-rules/evaluate": { post: { tags: ["Alert Rules"], summary: "Evaluate enabled alert rules against a metrics or health snapshot" } },
    "/alert-rules/evaluate-log": { post: { tags: ["Alert Rules"], summary: "Evaluate enabled log alert rules against PostgreSQL-backed logs" } },
    "/alert-rules/{ruleId}": {
      patch: { tags: ["Alert Rules"], summary: "Update alert rule" },
      delete: { tags: ["Alert Rules"], summary: "Delete alert rule" }
    },
    "/dashboard/summary": { get: { tags: ["Dashboard"], summary: "Dashboard summary" } },
    "/dashboard/service-health": { get: { tags: ["Dashboard"], summary: "Service health summary" } },
    "/dashboard/recent-incidents": { get: { tags: ["Dashboard"], summary: "Recent incidents" } },
    "/dashboard/error-trends": { get: { tags: ["Dashboard"], summary: "Error trend buckets" } },
    "/logs": { get: { tags: ["Logs"], summary: "Search PostgreSQL-backed ingested logs" } },
    "/telemetry/metrics": { get: { tags: ["Telemetry"], summary: "Query PostgreSQL-backed raw metrics" } },
    "/telemetry/metric-aggregates": { get: { tags: ["Telemetry"], summary: "Query PostgreSQL-backed metric aggregate buckets" } },
    "/audit-logs": { get: { tags: ["Audit"], summary: "List audit logs" } },
    "/health": { get: { tags: ["System"], summary: "Service health" } },
    "/openapi.json": { get: { tags: ["System"], summary: "OpenAPI document" } }
  }
};
