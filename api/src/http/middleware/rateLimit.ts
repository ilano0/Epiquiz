import type { RequestHandler } from "express";
import type { RedisClient } from "../../repositories/redis.js";

interface RateLimitOptions {
  name: string;
  limit: number;
  windowS: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterS: number;
}

export async function hitRateLimit(
  redis: RedisClient,
  options: RateLimitOptions,
  clientId: string,
): Promise<RateLimitResult> {
  const key = `rl:${options.name}:${clientId}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, options.windowS);
  }
  if (count > options.limit) {
    return { allowed: false, retryAfterS: Math.max(await redis.ttl(key), 1) };
  }
  return { allowed: true, retryAfterS: 0 };
}

export async function isRateLimited(
  redis: RedisClient,
  options: RateLimitOptions,
  clientId: string,
): Promise<boolean> {
  const count = Number((await redis.get(`rl:${options.name}:${clientId}`)) ?? 0);
  return count >= options.limit;
}

export function rateLimit(redis: RedisClient, options: RateLimitOptions): RequestHandler {
  return async (req, res, next) => {
    try {
      const result = await hitRateLimit(redis, options, req.ip ?? "unknown");
      if (!result.allowed) {
        res.set("Retry-After", String(result.retryAfterS));
        res.status(429).json({ error: "too_many_requests", retryAfterS: result.retryAfterS });
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
