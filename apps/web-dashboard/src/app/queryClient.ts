import { themeTokens } from "../shared/theme/tokens";

export const queryKeys = {
  overview: (orgId?: string, timeRange?: string) => ["overview", orgId ?? "all", timeRange ?? "24h"] as const,
  projects: (filters?: Record<string, unknown>) => ["projects", filters ?? {}] as const,
  project: (projectId: string) => ["project", projectId] as const,
  service: (serviceId: string) => ["service", serviceId] as const,
  logs: (filters?: Record<string, unknown>) => ["logs", filters ?? {}] as const,
  metrics: (filters?: Record<string, unknown>) => ["metrics", filters ?? {}] as const,
  incidents: (filters?: Record<string, unknown>) => ["incidents", filters ?? {}] as const,
  connectionStatus: (serviceId: string) => ["connection-status", serviceId] as const
};

export const queryStaleTimes = themeTokens.staleTimes;
