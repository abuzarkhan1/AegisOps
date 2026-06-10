import type { Request, Response, NextFunction } from "express";
import { redis } from "../../infrastructure/redis/client";
import { logger } from "../../infrastructure/logging/logger";

export const rateLimiter = (scope: string, limit: number, windowSeconds = 60) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      let identifier = req.ip || "unknown-ip";
      const user = (req as any).user;
      if (user && user.id) {
        identifier = user.id;
      }

      const minute = Math.floor(Date.now() / 1000 / windowSeconds);
      const key = `rate-limit:${scope}:${identifier}:${minute}`;

      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSeconds);
      }

      if (count > limit) {
        res.status(429).json({ error: `rate limit exceeded for ${scope}` });
        return;
      }

      next();
    } catch (error) {
      logger.error({ error, scope }, "Rate limiter middleware failed");
      next(); // fallback to let request pass if Redis fails
    }
  };
};
