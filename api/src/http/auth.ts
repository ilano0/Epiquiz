import { Router, type CookieOptions, type Response } from "express";
import { z } from "zod";
import {
  EmailAlreadyUsedError,
  InvalidCredentialsError,
  SESSION_MAX_AGE_S,
  type AuthService,
} from "../services/auth.js";
import type { RedisClient } from "../repositories/redis.js";
import { requireAuth, SESSION_COOKIE } from "./middleware/auth.js";
import { rateLimit } from "./middleware/rateLimit.js";

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(50),
});

const loginSchema = z.object({
  email: z.string().trim().max(254),
  password: z.string().min(1).max(128),
});

interface AuthRouterDeps {
  auth: AuthService;
  redis: RedisClient;
  secureCookies: boolean;
}

export function createAuthRouter({ auth, redis, secureCookies }: AuthRouterDeps): Router {
  const router = Router();

  const cookieOptions: CookieOptions = {
    httpOnly: true,
    secure: secureCookies,
    sameSite: "lax",
    path: "/",
  };

  function setSession(res: Response, token: string): void {
    res.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_MAX_AGE_S * 1000 });
  }

  const authLimiter = rateLimit(redis, { name: "auth", limit: 10, windowS: 60 });

  router.post("/register", authLimiter, async (req, res, next) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_input", fields: z.flattenError(parsed.error).fieldErrors });
      return;
    }
    try {
      const { user, token } = await auth.register(parsed.data);
      setSession(res, token);
      res.status(201).json({ user });
    } catch (err) {
      if (err instanceof EmailAlreadyUsedError) {
        res.status(409).json({ error: "email_already_used" });
        return;
      }
      next(err);
    }
  });

  router.post("/login", authLimiter, async (req, res, next) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_input", fields: z.flattenError(parsed.error).fieldErrors });
      return;
    }
    try {
      const { user, token } = await auth.login(parsed.data);
      setSession(res, token);
      res.json({ user });
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        res.status(401).json({ error: "invalid_credentials" });
        return;
      }
      next(err);
    }
  });

  router.post("/logout", (_req, res) => {
    res.clearCookie(SESSION_COOKIE, cookieOptions);
    res.status(204).end();
  });

  router.get("/me", requireAuth(auth), async (req, res, next) => {
    try {
      const user = await auth.findUser(req.userId!);
      if (!user) {
        res.clearCookie(SESSION_COOKIE, cookieOptions);
        res.status(401).json({ error: "unauthenticated" });
        return;
      }
      res.json({ user });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
