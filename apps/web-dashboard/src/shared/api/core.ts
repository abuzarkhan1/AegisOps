import { coreApiUrl, gatewayUrl } from "../../app/config";

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
  title: string;
  severity: string;
  status: string;
  summary?: string;
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
  description?: string;
  createdAt: string;
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

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function fetchServices() {
  const data = await request<{ services: ServiceRecord[] }>(`${coreApiUrl}/api/dashboard/service-health`);
  return data.services;
}

export async function fetchIncidents() {
  const data = await request<{ incidents: IncidentRecord[] }>(`${coreApiUrl}/api/incidents`);
  return data.incidents;
}

export async function fetchOrganizations() {
  const data = await request<{ organizations: OrganizationRecord[] }>(`${coreApiUrl}/api/organizations`);
  return data.organizations;
}

export async function fetchProjects(params?: Record<string, string>) {
  const query = new URLSearchParams(params ?? {}).toString();
  const data = await request<{ projects: ProjectRecord[] }>(`${coreApiUrl}/api/projects${query ? `?${query}` : ""}`);
  return data.projects;
}

export async function createProject(payload: Record<string, unknown>) {
  return request<{ project: ProjectRecord }>(`${coreApiUrl}/api/projects`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function createService(projectId: string, payload: Record<string, unknown>) {
  return request<{ service: ServiceRecord }>(`${coreApiUrl}/api/projects/${projectId}/services`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function createApiKey(serviceId: string, name: string) {
  return request<{ apiKey: { id: string; rawKey: string; prefix: string } }>(`${coreApiUrl}/api/services/${serviceId}/api-keys`, {
    method: "POST",
    body: JSON.stringify({ name })
  });
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

export async function fetchDashboardSummary() {
  const data = await request<{ summary: Record<string, number> }>(`${coreApiUrl}/api/dashboard/summary`);
  return data.summary;
}

export async function fetchErrorTrends(hours = 24) {
  const data = await request<{ buckets: Array<Record<string, number | string>> }>(`${coreApiUrl}/api/dashboard/error-trends?hours=${hours}`);
  return data.buckets;
}

export async function ingestLog(apiKey: string, payload: Record<string, unknown>) {
  return request<{ status: string; topic: string }>(`${gatewayUrl}/ingest/logs`, {
    method: "POST",
    headers: { "X-API-Key": apiKey },
    body: JSON.stringify(payload)
  });
}

export async function ingestMetric(apiKey: string, payload: Record<string, unknown>) {
  return request<{ status: string; topic: string }>(`${gatewayUrl}/metrics-api/ingest`, {
    method: "POST",
    headers: { "X-API-Key": apiKey },
    body: JSON.stringify(payload)
  });
}

export async function ingestCustomMetric(apiKey: string, payload: Record<string, unknown>) {
  return request<{ status: string; topic: string }>(`${gatewayUrl}/metrics-api/metrics/custom`, {
    method: "POST",
    headers: { "X-API-Key": apiKey },
    body: JSON.stringify(payload)
  });
}

export async function ingestBatchMetrics(apiKey: string, payload: Record<string, unknown>) {
  return request<{ status: string; topic: string; count: number }>(`${gatewayUrl}/metrics-api/metrics/batch`, {
    method: "POST",
    headers: { "X-API-Key": apiKey },
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

export async function fetchNotificationHistory() {
  const data = await request<{ history: NotificationHistoryRecord[] }>(`${gatewayUrl}/notify/history`);
  return data.history;
}

export async function saveNotificationSetting(orgId: string, payload: Record<string, unknown>) {
  return request<Record<string, unknown>>(`${gatewayUrl}/notify/settings/${orgId}`, {
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

export async function fetchLogs(params?: Record<string, string | number>) {
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

export async function fetchMetrics(params?: Record<string, string | number>) {
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

export async function fetchMetricAggregates(params?: Record<string, string | number>) {
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
  const data = await request<{ analysis: any[]; status: string }>(`${coreApiUrl}/api/incidents/${incidentId}/ai-analysis`);
  return data;
}

export async function fetchDeploymentImpact(deploymentId: string) {
  const data = await request<{ impact: any }>(`${gatewayUrl}/deployments/deployments/${deploymentId}/impact`);
  return data.impact;
}

export async function resolveIncident(incidentId: string) {
  return request<any>(`${coreApiUrl}/api/incidents/${incidentId}/resolve`, {
    method: "POST"
  });
}
