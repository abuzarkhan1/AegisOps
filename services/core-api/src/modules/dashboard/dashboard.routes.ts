import { Router } from "express";
import { asyncHandler } from "../../shared/http/asyncHandler";
import { incidentStatus } from "../../shared/http/requestValidation";
import { platformRepository } from "../platform/repositories/platform.repository";
import { rateLimiter } from "../../shared/http/rateLimiter";
import { cache } from "../../infrastructure/redis/cache";
import { redisKeyPatterns } from "../../utils/cacheKeys";

export const dashboardRouter = Router();

dashboardRouter.use(rateLimiter("dashboard-api", 120));
dashboardRouter.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const orgId = typeof req.query.organizationId === "string" ? req.query.organizationId : undefined;
    const cacheKey = redisKeyPatterns.orgDashboardSummary(orgId ?? "default");
    const cached = await cache.get<any>(cacheKey);
    if (cached) {
      res.json({ summary: cached });
      return;
    }
    const summary = await platformRepository.dashboardSummary(orgId);
    await cache.set(cacheKey, summary, 30); // 30 seconds TTL
    res.json({ summary });
  })
);

dashboardRouter.get(
  "/service-health",
  asyncHandler(async (_req, res) => {
    res.json({ services: await platformRepository.listServices() });
  })
);

dashboardRouter.get(
  "/recent-incidents",
  asyncHandler(async (req, res) => {
    const orgId = typeof req.query.organizationId === "string" ? req.query.organizationId : undefined;
    const status = incidentStatus(req.query.status);
    const cacheKey = `${redisKeyPatterns.orgRecentIncidents(orgId ?? "default")}${status ? `:status:${status}` : ""}`;
    const cached = await cache.get<any>(cacheKey);
    if (cached) {
      res.json({ incidents: cached });
      return;
    }
    const incidents = (
      await platformRepository.listIncidents({
        organizationId: orgId,
        status
      })
    ).slice(0, 10);
    await cache.set(cacheKey, incidents, 60); // 60 seconds TTL
    res.json({ incidents });
  })
);
dashboardRouter.get(
  "/error-trends",
  asyncHandler(async (req, res) => {
    const hours = typeof req.query.hours === "string" ? Number(req.query.hours) : 24;
    const orgId = typeof req.query.organizationId === "string" ? req.query.organizationId : undefined;
    res.json({ buckets: await platformRepository.dashboardErrorTrends(Number.isFinite(hours) ? hours : 24, orgId) });
  })
);
