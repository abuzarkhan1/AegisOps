import Redis from "ioredis";
import { env } from "../../config/env";
import { logger } from "../logging/logger";

export const redis = new Redis(env.REDIS_URL, {
  connectTimeout: 1000,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  retryStrategy: (attempt) => Math.min(attempt * 100, 2000)
});

redis.on("error", (error) => {
  logger.warn({ error }, "Redis client connection error");
});
