import { redis } from "./client";
import { logger } from "../logging/logger";

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const val = await redis.get(key);
      if (!val) return null;
      return JSON.parse(val) as T;
    } catch (error) {
      logger.error({ error, key }, "Redis cache get failed");
      return null;
    }
  },

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      logger.error({ error, key }, "Redis cache set failed");
    }
  },

  async delete(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (error) {
      logger.error({ error, key }, "Redis cache delete failed");
    }
  }
};
