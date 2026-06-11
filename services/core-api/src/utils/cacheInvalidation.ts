import { cache } from "../infrastructure/redis/cache";
import { redis } from "../infrastructure/redis/client";
import { logger } from "../infrastructure/logging/logger";

export async function clearDashboardCache(orgId: string | null | undefined) {
  if (!orgId) return;
  try {
    logger.info({ orgId }, "Clearing dashboard cache for organization");

    // Invalidate dashboard summary
    await cache.delete(`org:${orgId}:dashboard-summary`);
    await cache.delete(`org:default:dashboard-summary`);

    // Invalidate recent incidents
    await cache.delete(`org:${orgId}:recent-incidents`);
    await cache.delete(`org:default:recent-incidents`);
    await cache.delete(`org:${orgId}:recent-incidents:status:open`);
    await cache.delete(`org:default:recent-incidents:status:open`);
    await cache.delete(`org:${orgId}:recent-incidents:status:investigating`);
    await cache.delete(`org:default:recent-incidents:status:investigating`);

    // Clear route performance, recent logs, and metric chart data
    const patterns = [
      `route-performance:*`,
      `recent-logs:${orgId}:*`,
      `metric-chart-data:${orgId}:*`
    ];

    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }
  } catch (error) {
    logger.error({ error, orgId }, "Error clearing dashboard cache");
  }
}

export async function clearProjectCache(projectId: string | null | undefined, orgId: string | null | undefined) {
  if (projectId) {
    await cache.delete(`project:${projectId}:detail-summary`);
    // Clear route performance for this project
    try {
      const keys = await redis.keys(`route-performance:${projectId}:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      logger.error({ error, projectId }, "Error clearing project route performance cache");
    }
  }
  if (orgId) {
    await clearDashboardCache(orgId);
  }
}

export async function clearServiceCache(serviceId: string | null | undefined, orgId: string | null | undefined) {
  if (serviceId) {
    await cache.delete(`service:${serviceId}:detail-summary`);
  }
  if (orgId) {
    await clearDashboardCache(orgId);
  }
}
