export type UserRole = "owner" | "admin" | "engineer" | "viewer";
export type UserStatus = "active" | "inactive";
export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "open" | "investigating" | "identified" | "monitoring" | "resolved";
export type AlertOperator = "gt" | "lt" | "gte" | "lte" | "eq";
export type ApiKeyStatus = "active" | "revoked";
export type ServiceType =
  | "api"
  | "frontend"
  | "worker"
  | "database"
  | "db"
  | "queue"
  | "cache"
  | "message-broker"
  | "external"
  | "external-api";

export type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
};

export type AuthUser = User & {
  passwordHash: string;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  plan: "free" | "pro" | "enterprise";
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type Project = {
  id: string;
  organizationId: string;
  projectKey: string;
  name: string;
  environment: string;
  projectType: "monolith" | "microservices" | "worker-queue" | "frontend" | "hybrid";
  repositoryUrl?: string;
  ownerTeam?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
};

export type ServiceRecord = {
  id: string;
  organizationId: string;
  projectId: string;
  name: string;
  slug: string;
  environment: string;
  serviceType: ServiceType;
  language?: string;
  repositoryUrl?: string;
  healthStatus: "healthy" | "degraded" | "down" | "unknown";
  createdAt: string;
  updatedAt: string;
};

export type Incident = {
  id: string;
  organizationId: string;
  projectId?: string;
  serviceId?: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  assigneeId?: string;
  summary?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
};

export type AlertRule = {
  id: string;
  organizationId: string;
  serviceId?: string;
  name: string;
  metric: string;
  operator: AlertOperator;
  threshold: number;
  durationSeconds: number;
  severity: IncidentSeverity;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ApiKeyRecord = {
  id: string;
  organizationId: string;
  serviceId?: string;
  name: string;
  prefix: string;
  keyHash: string;
  status: ApiKeyStatus;
  lastUsedAt?: string;
  createdAt: string;
  revokedAt?: string;
};

export type AuditLog = {
  id: string;
  organizationId?: string;
  actorId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};
