import { coreApiUrl, gatewayUrl } from "../../app/config";

export type ServiceRecord = {
  id: string;
  name: string;
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
  createdAt: string;
};

export type DeploymentRecord = {
  id: string;
  provider: string;
  serviceName: string;
  environment: string;
  version?: string;
  commitSha?: string;
  deployedBy?: string;
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

export async function fetchDeployments() {
  const data = await request<{ deployments: DeploymentRecord[] }>(`${gatewayUrl}/deployments`);
  return data.deployments;
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
