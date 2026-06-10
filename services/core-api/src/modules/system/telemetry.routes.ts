import { Router } from "express";
import { asyncHandler } from "../../shared/http/asyncHandler";
import { platformRepository } from "../platform/repositories/platform.repository";

export const telemetryRouter = Router();

const stringQuery = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);
const numberQuery = (value: unknown) => {
  const parsed = typeof value === "string" ? Number(value) : undefined;
  return Number.isFinite(parsed) ? parsed : undefined;
};

telemetryRouter.get(
  "/telemetry/metrics",
  asyncHandler(async (req, res) => {
    const metrics = await platformRepository.listMetrics({
      organizationId: stringQuery(req.query.organizationId),
      projectId: stringQuery(req.query.projectId),
      serviceId: stringQuery(req.query.serviceId),
      projectKey: stringQuery(req.query.projectKey),
      serviceName: stringQuery(req.query.serviceName),
      environment: stringQuery(req.query.environment),
      metricName: stringQuery(req.query.metricName),
      from: stringQuery(req.query.from),
      to: stringQuery(req.query.to),
      limit: numberQuery(req.query.limit)
    });
    res.json({ metrics });
  })
);

telemetryRouter.get(
  "/telemetry/metric-aggregates",
  asyncHandler(async (req, res) => {
    const aggregates = await platformRepository.listMetricAggregates({
      organizationId: stringQuery(req.query.organizationId),
      projectId: stringQuery(req.query.projectId),
      serviceId: stringQuery(req.query.serviceId),
      projectKey: stringQuery(req.query.projectKey),
      serviceName: stringQuery(req.query.serviceName),
      environment: stringQuery(req.query.environment),
      metricName: stringQuery(req.query.metricName),
      window: stringQuery(req.query.window),
      from: stringQuery(req.query.from),
      to: stringQuery(req.query.to),
      limit: numberQuery(req.query.limit)
    });
    res.json({ aggregates });
  })
);
