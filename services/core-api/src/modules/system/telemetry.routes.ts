import { Router } from "express";
import { asyncHandler } from "../../shared/http/asyncHandler";
import { platformRepository } from "../platform/repositories/platform.repository";
import { requireOrganizationContext } from "../../shared/http/requireOrganizationContext";
import { cache } from "../../infrastructure/redis/cache";

export const telemetryRouter = Router();

telemetryRouter.use(requireOrganizationContext);

const stringQuery = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);
const numberQuery = (value: unknown) => {
  const parsed = typeof value === "string" ? Number(value) : undefined;
  return Number.isFinite(parsed) ? parsed : undefined;
};

const cacheParts = (...parts: Array<string | number | undefined>) =>
  parts.map((part) => (part === undefined || part === "" ? "all" : String(part))).join(":");

telemetryRouter.get(
  "/telemetry/metrics",
  asyncHandler(async (req, res) => {
    const organizationId = stringQuery(req.query.organizationId);
    const filters = {
      organizationId,
      projectId: stringQuery(req.query.projectId),
      serviceId: stringQuery(req.query.serviceId),
      projectKey: stringQuery(req.query.projectKey),
      serviceName: stringQuery(req.query.serviceName),
      environment: stringQuery(req.query.environment),
      metricName: stringQuery(req.query.metricName),
      from: stringQuery(req.query.from),
      to: stringQuery(req.query.to),
      limit: numberQuery(req.query.limit)
    };
    const cacheKey = cacheParts(
      "metric-chart-data",
      organizationId,
      filters.projectId,
      filters.serviceId,
      filters.environment,
      filters.metricName,
      filters.from,
      filters.to,
      filters.limit,
      "raw"
    );
    const cached = await cache.get<any[]>(cacheKey);
    if (cached) {
      res.json({ metrics: cached });
      return;
    }
    const metrics = await platformRepository.listMetrics(filters);
    await cache.set(cacheKey, metrics, 30);
    res.json({ metrics });
  })
);

telemetryRouter.get(
  "/telemetry/metric-aggregates",
  asyncHandler(async (req, res) => {
    const organizationId = stringQuery(req.query.organizationId);
    const filters = {
      organizationId,
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
    };
    const cacheKey = cacheParts(
      "metric-chart-data",
      organizationId,
      filters.projectId,
      filters.serviceId,
      filters.environment,
      filters.metricName,
      filters.window,
      filters.from,
      filters.to,
      filters.limit,
      "aggregates"
    );
    const cached = await cache.get<any[]>(cacheKey);
    if (cached) {
      res.json({ aggregates: cached });
      return;
    }
    const aggregates = await platformRepository.listMetricAggregates(filters);
    await cache.set(cacheKey, aggregates, 30);
    res.json({ aggregates });
  })
);

async function sendRoutePerformance(req: any, res: any, serviceId?: string) {
  const filters = {
    organizationId: stringQuery(req.query.organizationId),
    projectId: req.params.projectId,
    serviceId,
    environment: stringQuery(req.query.environment),
    from: stringQuery(req.query.from),
    to: stringQuery(req.query.to),
    sortBy: stringQuery(req.query.sortBy),
    limit: numberQuery(req.query.limit)
  };
  const cacheKey = cacheParts(
    "route-performance",
    filters.projectId,
    filters.serviceId,
    filters.organizationId,
    filters.environment,
    filters.from,
    filters.to,
    filters.sortBy,
    filters.limit
  );
  const cached = await cache.get<any[]>(cacheKey);
  if (cached) {
    res.json({ performance: cached });
    return;
  }
  const performance = await platformRepository.getRoutePerformance(filters);
  await cache.set(cacheKey, performance, 30);
  res.json({ performance });
}

telemetryRouter.get(
  "/v1/projects/:projectId/services/:serviceId/routes/performance",
  asyncHandler(async (req, res) => {
    await sendRoutePerformance(req, res, req.params.serviceId);
  })
);

telemetryRouter.get(
  "/projects/:projectId/services/:serviceId/routes/performance",
  asyncHandler(async (req, res) => {
    await sendRoutePerformance(req, res, req.params.serviceId);
  })
);

telemetryRouter.get(
  "/v1/projects/:projectId/routes/performance",
  asyncHandler(async (req, res) => {
    await sendRoutePerformance(req, res);
  })
);

telemetryRouter.get(
  "/projects/:projectId/routes/performance",
  asyncHandler(async (req, res) => {
    await sendRoutePerformance(req, res);
  })
);
