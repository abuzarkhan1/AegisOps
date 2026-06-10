import { Router } from "express";
import { asyncHandler } from "../../shared/http/asyncHandler";
import { notFound } from "../../shared/http/errors";
import {
  alertOperator,
  optionalBooleanQuery,
  optionalNumber,
  optionalString,
  requiredString,
  severity
} from "../../shared/http/requestValidation";
import { platformRepository } from "../platform/repositories/platform.repository";
import { cache } from "../../infrastructure/redis/cache";
import { redisKeyPatterns } from "../../utils/cacheKeys";
import { evaluateAlertRules, evaluateLogAlertRules } from "./services/alert-evaluation.service";

export const alertRuleRouter = Router();

const numericMetrics = (value: unknown) => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, metricValue]) => [key, Number(metricValue)] as const)
      .filter(([, metricValue]) => Number.isFinite(metricValue))
  );
};

alertRuleRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const orgId = typeof req.query.organizationId === "string" ? req.query.organizationId : undefined;
    const serviceId = typeof req.query.serviceId === "string" ? req.query.serviceId : undefined;
    const enabled = optionalBooleanQuery(req.query.enabled);

    if (orgId) {
      const cacheKey = `${redisKeyPatterns.orgAlertRules(orgId)}${serviceId ? `:service:${serviceId}` : ""}${enabled !== undefined ? `:enabled:${enabled}` : ""}`;
      const cached = await cache.get<any>(cacheKey);
      if (cached) {
        res.json({ alertRules: cached });
        return;
      }
      const alertRules = await platformRepository.listAlertRules({ organizationId: orgId, serviceId, enabled });
      await cache.set(cacheKey, alertRules, 120); // 2 mins TTL
      res.json({ alertRules });
      return;
    }

    res.json({
      alertRules: await platformRepository.listAlertRules({
        serviceId,
        enabled
      })
    });
  })
);
alertRuleRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const orgId = requiredString(req.body, "organizationId");
    const alertRule = await platformRepository.createAlertRule({
      organizationId: orgId,
      serviceId: optionalString(req.body, "serviceId"),
      name: requiredString(req.body, "name"),
      metric: requiredString(req.body, "metric"),
      operator: alertOperator(req.body.operator),
      threshold: optionalNumber(req.body, "threshold") ?? 0,
      durationSeconds: optionalNumber(req.body, "durationSeconds") ?? 300,
      severity: severity(req.body.severity),
      enabled: req.body.enabled !== false
    });
    await platformRepository.audit({
      organizationId: alertRule.organizationId,
      action: "alert_rule.created",
      resourceType: "alert_rule",
      resourceId: alertRule.id,
      metadata: { serviceId: alertRule.serviceId, metric: alertRule.metric, operator: alertRule.operator }
    });

    // Invalidate cache
    await cache.delete(redisKeyPatterns.orgAlertRules(orgId));

    res.status(201).json({ alertRule });
  })
);

alertRuleRouter.post(
  "/evaluate",
  asyncHandler(async (req, res) => {
    const result = await evaluateAlertRules({
      organizationId: requiredString(req.body, "organizationId"),
      projectId: optionalString(req.body, "projectId"),
      serviceId: optionalString(req.body, "serviceId"),
      serviceName: optionalString(req.body, "serviceName"),
      environment: optionalString(req.body, "environment"),
      metrics: numericMetrics(req.body.metrics),
      healthStatus: optionalString(req.body, "healthStatus"),
      timestamp: optionalString(req.body, "timestamp")
    });
    res.json(result);
  })
);

alertRuleRouter.post(
  "/evaluate-log",
  asyncHandler(async (req, res) => {
    const statusCode = optionalNumber(req.body, "statusCode");
    const metadata = typeof req.body.metadata === "object" && req.body.metadata !== null && !Array.isArray(req.body.metadata) ? req.body.metadata : {};
    const result = await evaluateLogAlertRules({
      organizationId: requiredString(req.body, "organizationId"),
      projectId: optionalString(req.body, "projectId"),
      serviceId: optionalString(req.body, "serviceId"),
      serviceName: optionalString(req.body, "serviceName"),
      environment: optionalString(req.body, "environment"),
      level: optionalString(req.body, "level"),
      message: optionalString(req.body, "message"),
      traceId: optionalString(req.body, "traceId"),
      requestId: optionalString(req.body, "requestId"),
      route: optionalString(req.body, "route"),
      statusCode,
      metadata,
      timestamp: optionalString(req.body, "timestamp")
    });
    res.json(result);
  })
);

alertRuleRouter.patch(
  "/:ruleId",
  asyncHandler(async (req, res) => {
    const alertRule = await platformRepository.updateAlertRule(req.params.ruleId, {
      name: optionalString(req.body, "name"),
      serviceId: optionalString(req.body, "serviceId"),
      metric: optionalString(req.body, "metric"),
      operator: req.body.operator ? alertOperator(req.body.operator) : undefined,
      threshold: optionalNumber(req.body, "threshold"),
      durationSeconds: optionalNumber(req.body, "durationSeconds"),
      severity: req.body.severity ? severity(req.body.severity) : undefined,
      enabled: typeof req.body.enabled === "boolean" ? req.body.enabled : undefined
    });
    if (!alertRule) throw notFound("Alert rule");
    await platformRepository.audit({
      organizationId: alertRule.organizationId,
      action: "alert_rule.updated",
      resourceType: "alert_rule",
      resourceId: alertRule.id
    });

    // Invalidate cache
    await cache.delete(redisKeyPatterns.orgAlertRules(alertRule.organizationId));

    res.json({ alertRule });
  })
);

alertRuleRouter.delete(
  "/:ruleId",
  asyncHandler(async (req, res) => {
    const existing = (await platformRepository.listAlertRules()).find((rule) => rule.id === req.params.ruleId);
    if (!(await platformRepository.deleteAlertRule(req.params.ruleId))) throw notFound("Alert rule");
    await platformRepository.audit({
      organizationId: existing?.organizationId,
      action: "alert_rule.deleted",
      resourceType: "alert_rule",
      resourceId: req.params.ruleId
    });

    // Invalidate cache
    if (existing?.organizationId) {
      await cache.delete(redisKeyPatterns.orgAlertRules(existing.organizationId));
    }

    res.status(204).send();
  })
);
