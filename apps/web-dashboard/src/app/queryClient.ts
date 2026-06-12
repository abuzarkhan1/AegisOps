import { QueryClient } from "@tanstack/react-query";
import { themeTokens } from "../shared/theme/tokens";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: themeTokens.staleTimes.overview,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});

export const queryKeys = {
  overview: (orgId?: string, timeRange?: string) => ["overview", orgId ?? "all", timeRange ?? "24h"] as const,
  errorTrends: (hours = 24) => ["error-trends", hours] as const,
  deployments: (filters?: Record<string, unknown>) => ["deployments", filters ?? {}] as const,
  projects: (filters?: Record<string, unknown>) => ["projects", filters ?? {}] as const,
  project: (projectId: string) => ["project", projectId] as const,
  service: (serviceId: string) => ["service", serviceId] as const,
  services: (filters?: Record<string, unknown>) => ["services", filters ?? {}] as const,
  apiKeys: (filters?: Record<string, unknown>) => ["api-keys", filters ?? {}] as const,
  alertRules: (filters?: Record<string, unknown>) => ["alert-rules", filters ?? {}] as const,
  logs: (filters?: Record<string, unknown>) => ["logs", filters ?? {}] as const,
  metrics: (filters?: Record<string, unknown>) => ["metrics", filters ?? {}] as const,
  incidents: (filters?: Record<string, unknown>) => ["incidents", filters ?? {}] as const,
  notifications: (filters?: Record<string, unknown>) => ["notifications", filters ?? {}] as const,
  organizations: () => ["organizations"] as const,
  setupStatus: () => ["setup-status"] as const,
  connectionStatus: (serviceId: string) => ["connection-status", serviceId] as const
};

export const queryStaleTimes = themeTokens.staleTimes;
