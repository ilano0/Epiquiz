import type { RequestHandler } from "express";
import type { RedisClient } from "../../repositories/redis.js";

interface RateLimitOptions {
  name: string;
  limit: number;
  windowS: number;
}

export function rateLimit(redis: RedisClient, options: RateLimitOptions): RequestHandler {
  return async (req, res, next) => {
    try {
      const key = `rl:${options.name}:${req.ip ?? "unknown"}`;
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, options.windowS);
      }
      if (count > options.limit) {
        const retryAfter = Math.max(await redis.ttl(key), 1);
        res.set("Retry-After", String(retryAfter));
        res.status(429).json({ error: "too_many_requests", retryAfterS: retryAfter });
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
