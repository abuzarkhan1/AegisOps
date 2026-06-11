import Redis from "ioredis";
import { env } from "../../config/env";
import { logger } from "../logging/logger";

const redis = new Redis(env.REDIS_URL, {
  connectTimeout: 1000,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  retryStrategy: (attempt) => Math.min(attempt * 100, 2000)
});

redis.on("error", (error) => {
  logger.warn({ error }, "Redis client connection error");
});

async function deletePattern(pattern: string) {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

export async function clearTelemetryCaches(input: { organizationId?: string | null; projectId?: string | null; serviceId?: string | null }) {
  try {
    const patterns = [
      input.organizationId ? `org:${input.organizationId}:dashboard-summary` : undefined,
      input.organizationId ? `org:${input.organizationId}:recent-incidents*` : undefined,
      input.organizationId ? `recent-logs:${input.organizationId}:*` : undefined,
      input.organizationId ? `metric-chart-data:${input.organizationId}:*` : undefined,
      input.projectId ? `project:${input.projectId}:detail-summary*` : undefined,
      input.projectId ? `route-performance:${input.projectId}:*` : "route-performance:*",
      input.serviceId ? `service:${input.serviceId}:detail-summary*` : undefined
    ].filter(Boolean) as string[];

    await Promise.all(patterns.map(deletePattern));
  } catch (error) {
    logger.error({ error, ...input }, "Failed to clear telemetry caches");
  }
}
