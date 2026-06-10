export const redisKeyPatterns = {
  orgProfile: (orgId: string) => `org:${orgId}:profile`,
  orgSettings: (orgId: string) => `org:${orgId}:settings`,
  orgProjects: (orgId: string) => `org:${orgId}:projects`,
  orgServices: (orgId: string) => `org:${orgId}:services`,
  orgAlertRules: (orgId: string) => `org:${orgId}:alert-rules`,
  orgDashboardSummary: (orgId: string) => `org:${orgId}:dashboard-summary`,
  orgRecentIncidents: (orgId: string) => `org:${orgId}:recent-incidents`,
  orgApiKey: (orgId: string, keyHash: string) => `org:${orgId}:api-key:${keyHash}`,
  userPermissions: (userId: string) => `user:${userId}:permissions`,
  serviceConfig: (serviceId: string) => `service:${serviceId}:config`,
  deploymentImpact: (deploymentId: string) => `deployment:${deploymentId}:impact`,
  incidentSummary: (incidentId: string) => `incident:${incidentId}:summary`,
  rateLimit: (apiKey: string, minute: string) => `rate-limit:${apiKey}:${minute}`
};

export const documentedRedisPatterns = [
  "org:{orgId}:profile",
  "org:{orgId}:settings",
  "org:{orgId}:projects",
  "org:{orgId}:services",
  "org:{orgId}:alert-rules",
  "org:{orgId}:dashboard-summary",
  "org:{orgId}:recent-incidents",
  "org:{orgId}:api-key:{keyHash}",
  "user:{userId}:permissions",
  "service:{serviceId}:config",
  "deployment:{deploymentId}:impact",
  "incident:{incidentId}:summary",
  "rate-limit:{apiKey}:{minute}"
];
