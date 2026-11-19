import type { RequestHandler } from "express";
import type { AuthService } from "../../services/auth.js";

export const SESSION_COOKIE = "epiquiz_session";

declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
  }
}

export function requireAuth(auth: AuthService): RequestHandler {
  return async (req, res, next) => {
    try {
      const token: unknown = req.cookies?.[SESSION_COOKIE];
      const userId = typeof token === "string" ? await auth.verifyToken(token) : null;
      if (!userId) {
        res.status(401).json({ error: "unauthenticated" });
        return;
      }
      req.userId = userId;
      next();
    } catch (err) {
      next(err);
    }
  };
}
