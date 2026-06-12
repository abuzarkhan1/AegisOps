import { coreApiUrl, gatewayUrl } from "../../app/config";

let accessTokenProvider: (() => string | undefined) | undefined;
let unauthorizedHandler: (() => void) | undefined;

export function configureApiAuth(options: { getAccessToken?: () => string | undefined; onUnauthorized?: () => void }) {
  accessTokenProvider = options.getAccessToken;
  unauthorizedHandler = options.onUnauthorized;
}

export type AuthUserRecord = {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "engineer" | "viewer" | string;
  status: string;
  createdAt: string;
  updatedAt?: string;
};

export type AuthSessionRecord = {
  user: AuthUserRecord;
  accessToken: string;
  refreshToken?: string;
  organization?: OrganizationRecord;
};

export type ServiceRecord = {
  id: string;
  organizationId?: string;
  projectId?: string;
  name: string;
  serviceType?: string;
  language?: string;
  repositoryUrl?: string;
  healthStatus: string;
  environment?: string;
};

export type IncidentRecord = {
  id: string;
  organizationId?: string;
  projectId?: string;
  serviceId?: string;
  title: string;
  severity: string;
  status: string;
  assigneeId?: string;
  summary?: string;
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string;
};

export type IncidentEvidenceRecord = {
  id: string;
  incidentId: string;
  evidenceType: string;
  sourceId?: string;
  title?: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type IncidentAnalysisRecord = {
  id: string;
  incidentId: string;
  summary: string;
  likelyRootCause: string;
  confidenceScore: number;
  evidence: string[];
  recommendedActions: string[];
  rollbackRecommendation?: string;
  postmortemDraft?: string;
  createdAt: string;
};

export type OrganizationRecord = {
  id: string;
  name: string;
  slug: string;
  plan?: string;
  createdAt: string;
};

export type ProjectRecord = {
  id: string;
  organizationId: string;
  projectKey?: string;
  name: string;
  environment: string;
  projectType?: "monolith" | "microservices" | "worker-queue" | "frontend" | "hybrid";
  repositoryUrl?: string;
  ownerTeam?: string;
  description?: string;
  createdAt: string;
};

export type ServiceConnectionStatus = {
  serviceId: string;
  connected: boolean;
  lastLogAt?: string;
  lastMetricAt?: string;
  lastHeartbeatAt?: string;
  status: "not_connected" | "waiting_for_telemetry" | "connected" | "stale" | "erroring" | string;
  logsLast15m?: number;
  metricsLast15m?: number;
  errorRateLast15m?: number;
  p95LatencyLast15m?: number;
  telemetryHealth?: {
    logs?: string;
    metrics?: string;
    alerts?: string;
  };
};

export type ApiKeyRecord = {
  id: string;
  organizationId: string;
  serviceId?: string;
  name: string;
  prefix: string;
  status: "active" | "revoked" | string;
  lastUsedAt?: string;
  createdAt: string;
  revokedAt?: string;
};

export type ApiKeyWithSecret = ApiKeyRecord & {
  rawKey: string;
};

export type AlertRuleRecord = {
  id: string;
  organizationId: string;
  serviceId?: string;
  name: string;
  metric: string;
  operator: string;
  threshold: number;
  durationSeconds: number;
  severity: string;
  enabled: boolean;
};

export type TeamMemberRecord = {
  id: string;
  email: string;
  name: string;
  memberRole: string;
  invitedAt: string;
};

export type DeploymentRecord = {
  id: string;
  provider: string;
  serviceName: string;
  environment: string;
  version?: string;
  commitSha?: string;
  branch?: string;
  status?: string;
  deployedBy?: string;
  repository?: string;
  timestamp?: string;
  receivedAt?: string;
  createdAt: string;
};

export type NotificationHistoryRecord = {
  id: string;
  organizationId: string;
  provider: string;
  status: string;
  subject: string;
  destination: string;
  createdAt: string;
};

export type NotificationSettingRecord = {
  id?: string;
  organizationId: string;
  provider: string;
  destination: string;
  enabled: boolean;
  createdAt?: string;
};

export type EscalationPolicyRecord = {
  id?: string;
  organizationId: string;
  name: string;
  severity: string;
  providers: string[];
  enabled: boolean;
  createdAt?: string;
};

export type AuditLogRecord = {
  id: string;
  organizationId?: string;
  actorId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  status?: string;
  ipAddress?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ReportRecord = {
  id: string;
  organizationId: string;
  projectId?: string;
  serviceId?: string;
  reportType: string;
  title: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  generatedBy?: string;
  payload: {
    summary?: Record<string, number | string>;
    telemetrySummary?: Record<string, number | string>;
    logSummary?: Record<string, number | string>;
    incidentSummary?: Record<string, number | string>;
    serviceHealth?: Record<string, number | string>;
    topSlowRoutes?: RoutePerformanceRecord[];
    topErroringServices?: Array<Record<string, number | string>>;
    deploymentSummary?: Record<string, any>;
    aiRecommendations?: Array<Record<string, any>>;
    recommendations?: string[];
    exports?: Record<string, string>;
    scope?: Record<string, string | undefined>;
    period?: Record<string, string>;
  };
  createdAt: string;
  updatedAt: string;
};

export type MetricRecord = {
  id: string;
  organizationId?: string;
  projectId?: string;
  serviceId?: string;
  projectKey?: string;
  serviceName: string;
  environment: string;
  metricName: string;
  value: number;
  labels: Record<string, unknown>;
  timestamp: string;
  createdAt: string;
};

export type MetricAggregateRecord = {
  id: string;
  organizationId?: string;
  projectId?: string;
  serviceId?: string;
  projectKey?: string;
  serviceName: string;
  environment: string;
  metricName: string;
  window: string;
  timestampBucket: string;
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
};

export type RoutePerformanceRecord = {
  route: string;
  method: string;
  requestCount: number;
  avgLatency: number;
  p95Latency: number;
  errorCount: number;
  errorRate: number;
  status2xx: number;
  status4xx: number;
  status5xx: number;
  lastSeen?: string;
};

export type ProjectDetailSummary = {
  servicesCount: number;
  healthyServices: number;
  degradedServices: number;
  downServices: number;
  activeIncidents: number;
  logsIngested: number;
  metricsIngested: number;
  totalThroughput: number;
  latencySamples: number;
  requestsPerSecond: number;
  errorRate: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  uptimePercent: number;
  lastDeploymentAt?: string;
};

export type ServiceDetailSummary = {
  totalThroughput: number;
  latencySamples: number;
  requestsPerSecond: number;
  errorRate: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  activeIncidents: number;
  logVolume: number;
  uptimePercent: number;
  lastDeploymentAt?: string;
  lastLogAt?: string;
  lastMetricAt?: string;
};

function toQuery(params?: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        query.set(key, String(value));
      }
    }
  }
  return query.toString();
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const authToken = accessTokenProvider?.();
  const headers = new Headers(init?.headers ?? {});
  if (!headers.has("content-type")) headers.set("content-type", "application/json");
  if (authToken && !headers.has("authorization")) headers.set("authorization", `Bearer ${authToken}`);

  const response = await fetch(url, {
    ...init,
    headers
  });
  if (!response.ok) {
    const body = await response.text();
    if (response.status === 401) unauthorizedHandler?.();
    throw new Error(body || `Request failed with ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  const body = await response.text();
  return (body ? JSON.parse(body) : undefined) as T;
}

export async function login(payload: { email: string; password: string }) {
  return request<AuthSessionRecord>(`${coreApiUrl}/api/auth/login`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function register(payload: { email: string; password: string; name?: string; organizationName?: string }) {
  return request<AuthSessionRecord>(`${coreApiUrl}/api/auth/register`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function refreshSession(refreshToken?: string) {
  return request<Partial<AuthSessionRecord> & { user: AuthUserRecord; accessToken: string }>(`${coreApiUrl}/api/auth/refresh`, {
    method: "POST",
    body: JSON.stringify({ refreshToken })
  });
}

export async function logout(refreshToken?: string) {
  return request<void>(`${coreApiUrl}/api/auth/logout`, {
    method: "POST",
    body: JSON.stringify({ refreshToken })
  });
}

export async function fetchCurrentUser() {
  const data = await request<{ user: AuthUserRecord }>(`${coreApiUrl}/api/auth/me`);
  return data.user;
}

export async function fetchServices(params?: Record<string, string | number | undefined>) {
  const query = toQuery(params);
  const data = await request<{ services: ServiceRecord[] }>(`${coreApiUrl}/api/dashboard/service-health${query ? `?${query}` : ""}`);
  return data.services;
}

export async function fetchIncidents(params?: Record<string, string | number | undefined>) {
  const query = toQuery(params);
  const data = await request<{ incidents: IncidentRecord[] }>(`${coreApiUrl}/api/incidents${query ? `?${query}` : ""}`);
  return data.incidents;
}

export async function createIncident(payload: Record<string, unknown>) {
  return request<{ incident: IncidentRecord }>(`${coreApiUrl}/api/incidents`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function fetchOrganizations() {
  const data = await request<{ organizations: OrganizationRecord[] }>(`${coreApiUrl}/api/organizations`);
  return data.organizations;
}

export async function createOrganization(payload: Record<string, unknown>) {
  return request<{ organization: OrganizationRecord }>(`${coreApiUrl}/api/organizations`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateOrganization(orgId: string, payload: Record<string, unknown>) {
  return request<{ organization: OrganizationRecord }>(`${coreApiUrl}/api/organizations/${orgId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function fetchProjects(params?: Record<string, string>) {
  const query = new URLSearchParams(params ?? {}).toString();
  const data = await request<{ projects: ProjectRecord[] }>(`${coreApiUrl}/api/projects${query ? `?${query}` : ""}`);
  return data.projects;
}

export async function fetchProject(projectId: string) {
  const data = await request<{ project: ProjectRecord }>(`${coreApiUrl}/api/projects/${projectId}`);
  return data.project;
}

export async function fetchProjectDetailSummary(projectId: string, params?: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
    }
  }
  const data = await request<{ summary: ProjectDetailSummary }>(
    `${coreApiUrl}/api/projects/${projectId}/detail-summary${query.toString() ? `?${query}` : ""}`
  );
  return data.summary;
}

export async function createProject(payload: Record<string, unknown>) {
  return request<{ project: ProjectRecord }>(`${coreApiUrl}/api/v1/projects`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateProject(projectId: string, payload: Record<string, unknown>) {
  return request<{ project: ProjectRecord }>(`${coreApiUrl}/api/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function deleteProject(projectId: string) {
  return request<void>(`${coreApiUrl}/api/projects/${projectId}`, {
    method: "DELETE"
  });
}

export async function createService(projectId: string, payload: Record<string, unknown>) {
  return request<{ service: ServiceRecord }>(`${coreApiUrl}/api/v1/projects/${projectId}/services`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function fetchProjectServices(projectId: string) {
  const data = await request<{ services: ServiceRecord[] }>(`${coreApiUrl}/api/v1/projects/${projectId}/services`);
  return data.services;
}

export async function fetchService(serviceId: string) {
  const data = await request<{ service: ServiceRecord }>(`${coreApiUrl}/api/services/${serviceId}`);
  return data.service;
}

export async function updateService(serviceId: string, payload: Record<string, unknown>) {
  return request<{ service: ServiceRecord }>(`${coreApiUrl}/api/services/${serviceId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function deleteService(serviceId: string) {
  return request<void>(`${coreApiUrl}/api/services/${serviceId}`, {
    method: "DELETE"
  });
}

export async function fetchServiceDetailSummary(serviceId: string, params?: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
    }
  }
  const data = await request<{ summary: ServiceDetailSummary }>(
    `${coreApiUrl}/api/services/${serviceId}/detail-summary${query.toString() ? `?${query}` : ""}`
  );
  return data.summary;
}

export async function createApiKey(serviceId: string, name: string) {
  return request<{ apiKey: ApiKeyWithSecret }>(`${coreApiUrl}/api/v1/services/${serviceId}/api-keys`, {
    method: "POST",
    body: JSON.stringify({ name })
  });
}

export async function createManagedApiKey(payload: { organizationId: string; serviceId?: string; name: string }) {
  return request<{ apiKey: ApiKeyWithSecret }>(`${coreApiUrl}/api/api-keys`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function fetchApiKeys(params?: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) query.set(key, value);
  }
  const data = await request<{ apiKeys: ApiKeyRecord[] }>(`${coreApiUrl}/api/api-keys${query.toString() ? `?${query}` : ""}`);
  return data.apiKeys;
}

export async function fetchServiceApiKeys(serviceId: string) {
  const data = await request<{ apiKeys: ApiKeyRecord[] }>(`${coreApiUrl}/api/v1/services/${serviceId}/api-keys`);
  return data.apiKeys;
}

export async function rotateApiKey(apiKeyId: string) {
  return request<{ apiKey: ApiKeyWithSecret; revokedApiKey: ApiKeyRecord }>(`${coreApiUrl}/api/api-keys/${apiKeyId}/rotate`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export async function revokeApiKey(apiKeyId: string) {
  return request<void>(`${coreApiUrl}/api/api-keys/${apiKeyId}`, {
    method: "DELETE"
  });
}

export async function fetchServiceConnectionStatus(serviceId: string) {
  return request<ServiceConnectionStatus>(`${coreApiUrl}/api/v1/services/${serviceId}/connection-status`);
}

export async function sendServiceTestEvent(serviceId: string) {
  return request<{ event: Record<string, unknown>; connectionStatus: ServiceConnectionStatus }>(
    `${coreApiUrl}/api/v1/services/${serviceId}/test-event`,
    {
      method: "POST",
      body: JSON.stringify({})
    }
  );
}

export async function fetchTeamMembers(orgId: string) {
  const data = await request<{ users: TeamMemberRecord[] }>(`${coreApiUrl}/api/organizations/${orgId}/users`);
  return data.users;
}

export async function inviteTeamMember(orgId: string, payload: Record<string, unknown>) {
  return request<Record<string, unknown>>(`${coreApiUrl}/api/organizations/${orgId}/users/invite`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateTeamMemberRole(orgId: string, userId: string, role: string) {
  return request<Record<string, unknown>>(`${coreApiUrl}/api/organizations/${orgId}/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role })
  });
}

export async function removeTeamMember(orgId: string, userId: string) {
  return request<void>(`${coreApiUrl}/api/organizations/${orgId}/users/${userId}`, {
    method: "DELETE"
  });
}

export async function fetchAlertRules(params?: Record<string, string>) {
  const query = new URLSearchParams(params ?? {}).toString();
  const data = await request<{ alertRules: AlertRuleRecord[] }>(`${coreApiUrl}/api/alert-rules${query ? `?${query}` : ""}`);
  return data.alertRules;
}

export async function createAlertRule(payload: Record<string, unknown>) {
  return request<{ alertRule: AlertRuleRecord }>(`${coreApiUrl}/api/alert-rules`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function evaluateAlertRules(payload: Record<string, unknown>) {
  return request<{ evaluated: number; breached: number; results: any[] }>(`${coreApiUrl}/api/alert-rules/evaluate`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function evaluateLogAlertRules(payload: Record<string, unknown>) {
  return request<{ evaluated: number; breached: number; results: any[] }>(`${coreApiUrl}/api/alert-rules/evaluate-log`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateAlertRule(ruleId: string, payload: Record<string, unknown>) {
  return request<{ alertRule: AlertRuleRecord }>(`${coreApiUrl}/api/alert-rules/${ruleId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function deleteAlertRule(ruleId: string) {
  return request<void>(`${coreApiUrl}/api/alert-rules/${ruleId}`, {
    method: "DELETE"
  });
}

export async function fetchDashboardSummary(params?: Record<string, string | number | undefined>) {
  const query = toQuery(params);
  const data = await request<{ summary: Record<string, number> }>(`${coreApiUrl}/api/dashboard/summary${query ? `?${query}` : ""}`);
  return data.summary;
}

export async function fetchErrorTrends(hours = 24, params?: Record<string, string | number | undefined>) {
  const query = toQuery({ hours, ...(params ?? {}) });
  const data = await request<{ buckets: Array<Record<string, number | string>> }>(`${coreApiUrl}/api/dashboard/error-trends?${query}`);
  return data.buckets;
}

export async function ingestLog(apiKey: string, payload: Record<string, unknown>) {
  return request<{ status: string; topic: string }>(`${gatewayUrl}/ingest/logs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload)
  });
}

export async function ingestMetric(apiKey: string, payload: Record<string, unknown>) {
  return request<{ status: string; topic: string }>(`${gatewayUrl}/metrics-api/ingest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload)
  });
}

export async function ingestCustomMetric(apiKey: string, payload: Record<string, unknown>) {
  return request<{ status: string; topic: string }>(`${gatewayUrl}/metrics-api/metrics/custom`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload)
  });
}

export async function ingestBatchMetrics(apiKey: string, payload: Record<string, unknown>) {
  return request<{ status: string; topic: string; count: number }>(`${gatewayUrl}/metrics-api/metrics/batch`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload)
  });
}

export async function fetchDeployments() {
  const data = await request<{ deployments: DeploymentRecord[] }>(`${gatewayUrl}/deployments`);
  return data.deployments.map((deployment: any) => ({
    ...deployment,
    createdAt: deployment.createdAt ?? deployment.receivedAt ?? deployment.timestamp ?? new Date().toISOString()
  }));
}

export async function createDeployment(provider: "github" | "gitlab", payload: Record<string, unknown>) {
  return request<{ status: string; topic: string; deployment: DeploymentRecord }>(`${gatewayUrl}/deployments/${provider}`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function analyzeIncident(payload: Record<string, unknown>) {
  return request<Record<string, unknown>>(`${gatewayUrl}/ai/analyze-incident`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function summarizeLogs(payload: Record<string, unknown>) {
  return request<Record<string, unknown>>(`${gatewayUrl}/ai/summarize-logs`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function fetchNotificationHistory(orgId?: string) {
  const data = await request<{ history: NotificationHistoryRecord[] }>(`${gatewayUrl}/notify/history${orgId ? `/${orgId}` : ""}`);
  return data.history;
}

export async function fetchNotificationSettings(orgId?: string) {
  const data = await request<{ settings: NotificationSettingRecord[] }>(`${gatewayUrl}/notify/settings${orgId ? `/${orgId}` : ""}`);
  return data.settings;
}

export async function fetchEscalationPolicies(orgId?: string) {
  const data = await request<{ policies: EscalationPolicyRecord[] }>(`${gatewayUrl}/notify/escalation-policies${orgId ? `/${orgId}` : ""}`);
  return data.policies;
}

export async function fetchAuditLogs(params?: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
    }
  }
  const data = await request<{ auditLogs: AuditLogRecord[] }>(`${coreApiUrl}/api/audit-logs${query.toString() ? `?${query}` : ""}`);
  return data.auditLogs;
}

export async function saveNotificationSetting(orgId: string, payload: Record<string, unknown>) {
  return request<Record<string, unknown>>(`${gatewayUrl}/notify/settings/${orgId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function saveEscalationPolicy(orgId: string, payload: Record<string, unknown>) {
  return request<Record<string, unknown>>(`${gatewayUrl}/notify/escalation-policies/${orgId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function sendNotification(provider: "email" | "slack" | "discord", payload: Record<string, unknown>) {
  return request<Record<string, unknown>>(`${gatewayUrl}/notify/${provider}`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function fetchLogs(params?: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        query.set(key, String(value));
      }
    }
  }
  const queryString = query.toString();
  const url = `${coreApiUrl}/api/logs${queryString ? "?" + queryString : ""}`;
  const data = await request<{ logs: any[] }>(url);
  return data.logs;
}

export async function fetchMetrics(params?: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        query.set(key, String(value));
      }
    }
  }
  const data = await request<{ metrics: MetricRecord[] }>(`${coreApiUrl}/api/telemetry/metrics${query.toString() ? `?${query}` : ""}`);
  return data.metrics;
}

export async function fetchMetricAggregates(params?: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        query.set(key, String(value));
      }
    }
  }
  const data = await request<{ aggregates: MetricAggregateRecord[] }>(
    `${coreApiUrl}/api/telemetry/metric-aggregates${query.toString() ? `?${query}` : ""}`
  );
  return data.aggregates;
}

export async function fetchIncidentTimeline(incidentId: string) {
  const data = await request<{ timeline: any[] }>(`${coreApiUrl}/api/incidents/${incidentId}/timeline`);
  return data.timeline;
}

export async function fetchIncidentAnalysis(incidentId: string) {
  const data = await request<{ analysis: IncidentAnalysisRecord[]; status: string }>(
    `${coreApiUrl}/api/incidents/${incidentId}/ai-analysis`
  );
  return data;
}

export async function saveIncidentAnalysis(incidentId: string, payload: Record<string, unknown>) {
  return request<{ incidentId: string; analysis: IncidentAnalysisRecord }>(`${coreApiUrl}/api/incidents/${incidentId}/ai-analysis`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function fetchIncidentEvidence(incidentId: string) {
  const data = await request<{ evidence: IncidentEvidenceRecord[] }>(`${coreApiUrl}/api/incidents/${incidentId}/evidence`);
  return data.evidence;
}

export async function addIncidentEvidence(incidentId: string, payload: Record<string, unknown>) {
  return request<{ evidence: IncidentEvidenceRecord }>(`${coreApiUrl}/api/incidents/${incidentId}/evidence`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function fetchDeploymentImpact(deploymentId: string) {
  const data = await request<{ impact: any }>(`${gatewayUrl}/deployments/${deploymentId}/impact`);
  return data.impact;
}

export async function resolveIncident(incidentId: string) {
  return request<any>(`${coreApiUrl}/api/incidents/${incidentId}/resolve`, {
    method: "POST"
  });
}

async function incidentAction(incidentId: string, action: string, payload?: Record<string, unknown>) {
  return request<{ incident: IncidentRecord }>(`${coreApiUrl}/api/incidents/${incidentId}/${action}`, {
    method: "POST",
    body: JSON.stringify(payload ?? {})
  });
}

export async function acknowledgeIncident(incidentId: string, payload?: Record<string, unknown>) {
  return incidentAction(incidentId, "acknowledge", payload);
}

export async function identifyIncident(incidentId: string, payload?: Record<string, unknown>) {
  return incidentAction(incidentId, "identify", payload);
}

export async function monitorIncident(incidentId: string, payload?: Record<string, unknown>) {
  return incidentAction(incidentId, "monitor", payload);
}

export async function reopenIncident(incidentId: string, payload?: Record<string, unknown>) {
  return incidentAction(incidentId, "reopen", payload);
}

export async function closeIncident(incidentId: string, payload?: Record<string, unknown>) {
  return incidentAction(incidentId, "close", payload);
}

export async function generateIncidentPostmortem(incidentId: string) {
  return request<{ incidentId: string; postmortemDraft: string; analysis: IncidentAnalysisRecord }>(
    `${coreApiUrl}/api/incidents/${incidentId}/postmortem`,
    {
      method: "POST"
    }
  );
}

export async function fetchRoutePerformance(projectId: string, serviceId?: string, params?: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        query.set(key, String(value));
      }
    }
  }
  const queryString = query.toString();
  const url = serviceId
    ? `${coreApiUrl}/api/v1/projects/${projectId}/services/${serviceId}/routes/performance${queryString ? `?${queryString}` : ""}`
    : `${coreApiUrl}/api/v1/projects/${projectId}/routes/performance${queryString ? `?${queryString}` : ""}`;
  const data = await request<{ performance: RoutePerformanceRecord[] }>(url);
  return data.performance;
}

export async function fetchReports(params?: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        query.set(key, String(value));
      }
    }
  }
  const data = await request<{ reports: ReportRecord[] }>(`${coreApiUrl}/api/reports${query.toString() ? `?${query}` : ""}`);
  return data.reports;
}

export async function generateReport(payload: Record<string, unknown>) {
  return request<{ report: ReportRecord }>(`${coreApiUrl}/api/reports/generate`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
