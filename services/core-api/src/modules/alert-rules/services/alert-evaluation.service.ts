import { publishDomainEvent } from "../../../infrastructure/kafka/producer";
import { clearDashboardCache, clearProjectCache, clearServiceCache } from "../../../utils/cacheInvalidation";
import { platformRepository } from "../../platform/repositories/platform.repository";
import type { AlertRule } from "../../platform/types/platform.types";

type AlertEvaluationInput = {
  organizationId: string;
  projectId?: string;
  serviceId?: string;
  serviceName?: string;
  environment?: string;
  metrics?: Record<string, number>;
  healthStatus?: string;
  timestamp?: string;
};

type LogAlertEvaluationInput = {
  organizationId: string;
  projectId?: string;
  serviceId?: string;
  serviceName?: string;
  environment?: string;
  level?: string;
  message?: string;
  traceId?: string;
  requestId?: string;
  route?: string;
  statusCode?: number;
  metadata?: Record<string, unknown>;
  timestamp?: string;
};

type EvaluationResult = {
  ruleId: string;
  ruleName: string;
  metric: string;
  value?: number;
  breached: boolean;
  incidentId?: string;
  duplicateSuppressed?: boolean;
};

type LogRuleConfig = {
  levels?: string[];
  contains?: string;
  label: string;
};

const metricAliases: Record<string, string[]> = {
  error_rate: ["error_rate", "errorRate"],
  latency: ["latency", "p95LatencyMs", "avgLatencyMs"],
  cpu: ["cpu", "cpuUsage", "cpu_usage"],
  memory: ["memory", "memoryUsage", "memory_usage"],
  request_count: ["request_count", "requestCount"],
  error_count: ["error_count", "errorCount"]
};

const valueForRule = (rule: AlertRule, input: AlertEvaluationInput) => {
  const metrics = input.metrics ?? {};
  if (rule.metric === "service_health") {
    if (input.healthStatus === "down") return 1;
    if (input.healthStatus === "degraded") return 0.5;
    if (input.healthStatus === "healthy") return 0;
  }

  if (rule.metric === "error_rate" && metrics.requestCount && metrics.errorCount !== undefined) {
    return metrics.requestCount > 0 ? (metrics.errorCount / metrics.requestCount) * 100 : 0;
  }

  const keys = metricAliases[rule.metric] ?? [rule.metric];
  for (const key of keys) {
    const value = metrics[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
};

const compare = (operator: AlertRule["operator"], value: number, threshold: number) => {
  switch (operator) {
    case "gt":
      return value > threshold;
    case "gte":
      return value >= threshold;
    case "lt":
      return value < threshold;
    case "lte":
      return value <= threshold;
    case "eq":
      return value === threshold;
  }
};

const logRuleConfig = (metric: string): LogRuleConfig | undefined => {
  const normalized = metric.trim().toLowerCase();
  if (normalized === "critical_logs") {
    return { levels: ["critical", "fatal"], label: "critical log count" };
  }
  if (normalized === "error_logs" || normalized === "log_level_error") {
    return { levels: ["error", "critical", "fatal"], label: "error log count" };
  }
  if (normalized === "warning_logs" || normalized === "warn_logs") {
    return { levels: ["warn", "warning"], label: "warning log count" };
  }
  if (normalized === "exception_count") {
    return { contains: "exception", label: "exception log count" };
  }
  if (normalized === "log_count") {
    return { label: "log count" };
  }
  if (normalized.startsWith("log_contains:") || normalized.startsWith("message_contains:")) {
    const contains = metric.split(":").slice(1).join(":").trim();
    return contains ? { contains, label: `logs containing "${contains}"` } : undefined;
  }
  return undefined;
};

export async function evaluateAlertRules(input: AlertEvaluationInput) {
  const rules = await platformRepository.listAlertRules({
    organizationId: input.organizationId,
    serviceId: input.serviceId,
    enabled: true
  });

  const results: EvaluationResult[] = [];
  for (const rule of rules) {
    const value = valueForRule(rule, input);
    const breached = value !== undefined && compare(rule.operator, value, rule.threshold);
    const result: EvaluationResult = {
      ruleId: rule.id,
      ruleName: rule.name,
      metric: rule.metric,
      value,
      breached
    };

    if (breached) {
      const title = `Alert: ${rule.name}`;
      const existingIncident = await platformRepository.findOpenIncidentByTitle({
        organizationId: input.organizationId,
        serviceId: input.serviceId,
        title
      });

      if (existingIncident) {
        result.incidentId = existingIncident.id;
        result.duplicateSuppressed = true;
        await platformRepository.createIncidentTimelineEvent({
          incidentId: existingIncident.id,
          eventType: "alert_duplicate_suppressed",
          message: `Alert rule ${rule.name} breached again; duplicate incident suppressed.`,
          metadata: { ruleId: rule.id, metric: rule.metric, value, threshold: rule.threshold }
        });
      } else {
        const incident = await platformRepository.createIncident({
          organizationId: input.organizationId,
          projectId: input.projectId,
          serviceId: input.serviceId,
          title,
          severity: rule.severity,
          summary: `${rule.metric} ${rule.operator} ${rule.threshold} for ${input.serviceName ?? input.serviceId ?? "service"}; observed ${value}.`
        });
        result.incidentId = incident.id;
        await platformRepository.createIncidentTimelineEvent({
          incidentId: incident.id,
          eventType: "alert_rule_triggered",
          message: `Alert rule ${rule.name} triggered this incident.`,
          metadata: { ruleId: rule.id, metric: rule.metric, operator: rule.operator, value, threshold: rule.threshold }
        });
        await platformRepository.createIncidentEvidence({
          incidentId: incident.id,
          evidenceType: "metric",
          title: rule.name,
          payload: {
            ruleId: rule.id,
            metric: rule.metric,
            operator: rule.operator,
            value,
            threshold: rule.threshold,
            serviceName: input.serviceName,
            environment: input.environment,
            metrics: input.metrics,
            healthStatus: input.healthStatus,
            timestamp: input.timestamp ?? new Date().toISOString()
          }
        });
        await platformRepository.audit({
          organizationId: input.organizationId,
          action: "alert_rule.triggered",
          resourceType: "alert_rule",
          resourceId: rule.id,
          metadata: { incidentId: incident.id, serviceId: input.serviceId, metric: rule.metric, value, threshold: rule.threshold }
        });
        await publishDomainEvent(
          "incidents.created",
          {
            organizationId: incident.organizationId,
            projectId: incident.projectId,
            serviceId: incident.serviceId,
            incidentId: incident.id,
            id: incident.id,
            title: incident.title,
            summary: incident.summary,
            severity: incident.severity,
            status: incident.status,
            alertRuleId: rule.id,
            metric: rule.metric,
            value,
            threshold: rule.threshold,
            environment: input.environment,
            occurredAt: input.timestamp ?? new Date().toISOString()
          },
          incident.id
        );
      }
      await clearDashboardCache(input.organizationId);
      await clearProjectCache(input.projectId, input.organizationId);
      await clearServiceCache(input.serviceId, input.organizationId);
    }

    results.push(result);
  }

  return {
    evaluated: results.length,
    breached: results.filter((result) => result.breached).length,
    results
  };
}

export async function evaluateLogAlertRules(input: LogAlertEvaluationInput) {
  const rules = await platformRepository.listAlertRules({
    organizationId: input.organizationId,
    serviceId: input.serviceId,
    enabled: true
  });

  const timestamp = input.timestamp ? new Date(input.timestamp) : new Date();
  const results: EvaluationResult[] = [];
  for (const rule of rules) {
    const config = logRuleConfig(rule.metric);
    if (!config) {
      continue;
    }

    const from = new Date(timestamp.getTime() - rule.durationSeconds * 1000).toISOString();
    const value = await platformRepository.countLogsForAlert({
      organizationId: input.organizationId,
      serviceId: input.serviceId,
      environment: input.environment,
      from,
      levels: config.levels,
      contains: config.contains
    });
    const breached = compare(rule.operator, value, rule.threshold);
    const result: EvaluationResult = {
      ruleId: rule.id,
      ruleName: rule.name,
      metric: rule.metric,
      value,
      breached
    };

    if (breached) {
      const title = `Alert: ${rule.name}`;
      const existingIncident = await platformRepository.findOpenIncidentByTitle({
        organizationId: input.organizationId,
        serviceId: input.serviceId,
        title
      });

      if (existingIncident) {
        result.incidentId = existingIncident.id;
        result.duplicateSuppressed = true;
        await platformRepository.createIncidentTimelineEvent({
          incidentId: existingIncident.id,
          eventType: "log_alert_duplicate_suppressed",
          message: `Log alert rule ${rule.name} breached again; duplicate incident suppressed.`,
          metadata: { ruleId: rule.id, metric: rule.metric, value, threshold: rule.threshold, traceId: input.traceId, requestId: input.requestId }
        });
      } else {
        const incident = await platformRepository.createIncident({
          organizationId: input.organizationId,
          projectId: input.projectId,
          serviceId: input.serviceId,
          title,
          severity: rule.severity,
          summary: `${config.label} ${rule.operator} ${rule.threshold} for ${input.serviceName ?? input.serviceId ?? "service"}; observed ${value}.`
        });
        result.incidentId = incident.id;
        await platformRepository.createIncidentTimelineEvent({
          incidentId: incident.id,
          eventType: "log_alert_rule_triggered",
          message: `Log alert rule ${rule.name} triggered this incident.`,
          metadata: { ruleId: rule.id, metric: rule.metric, operator: rule.operator, value, threshold: rule.threshold }
        });
        await platformRepository.createIncidentEvidence({
          incidentId: incident.id,
          evidenceType: "log",
          title: input.message ?? rule.name,
          payload: {
            ruleId: rule.id,
            metric: rule.metric,
            value,
            threshold: rule.threshold,
            level: input.level,
            message: input.message,
            traceId: input.traceId,
            requestId: input.requestId,
            route: input.route,
            statusCode: input.statusCode,
            metadata: input.metadata
          }
        });
        await platformRepository.audit({
          organizationId: input.organizationId,
          action: "alert_rule.log_triggered",
          resourceType: "alert_rule",
          resourceId: rule.id,
          metadata: { incidentId: incident.id, serviceId: input.serviceId, metric: rule.metric, value, threshold: rule.threshold }
        });
        await publishDomainEvent(
          "incidents.created",
          {
            organizationId: incident.organizationId,
            projectId: incident.projectId,
            serviceId: incident.serviceId,
            incidentId: incident.id,
            id: incident.id,
            title: incident.title,
            summary: incident.summary,
            severity: incident.severity,
            status: incident.status,
            alertRuleId: rule.id,
            metric: rule.metric,
            value,
            threshold: rule.threshold,
            environment: input.environment,
            traceId: input.traceId,
            requestId: input.requestId,
            occurredAt: input.timestamp ?? new Date().toISOString()
          },
          incident.id
        );
      }
      await clearDashboardCache(input.organizationId);
      await clearProjectCache(input.projectId, input.organizationId);
      await clearServiceCache(input.serviceId, input.organizationId);
    }

    results.push(result);
  }

  return {
    evaluated: results.length,
    breached: results.filter((result) => result.breached).length,
    results
  };
}
