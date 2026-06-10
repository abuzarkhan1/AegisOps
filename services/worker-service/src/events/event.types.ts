export type AegisOpsEvent = {
  eventType?: string;
  organizationId?: string;
  projectId?: string;
  serviceId?: string;
  incidentId?: string;
  deploymentId?: string;
  serviceName?: string;
  severity?: string;
  title?: string;
  summary?: string;
  timestamp?: string;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
};

export type WorkerTask = {
  taskType: string;
  sourceTopic: string;
  createdAt: string;
  payload: AegisOpsEvent;
};

