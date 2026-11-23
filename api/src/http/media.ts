import express, { Router, type ErrorRequestHandler } from "express";
import { pipeline } from "node:stream/promises";
import {
  InvalidMediaError,
  MAX_MEDIA_BYTES,
  MEDIA_MIME_TYPES,
  MediaNotFoundError,
  type MediaService,
} from "../services/media.js";
import type { AuthService } from "../services/auth.js";
import type { RedisClient } from "../repositories/redis.js";
import { requireAuth } from "./middleware/auth.js";
import { rateLimit } from "./middleware/rateLimit.js";

interface MediaRouterDeps {
  auth: AuthService;
  media: MediaService;
  redis: RedisClient;
}

const onUploadError: ErrorRequestHandler = (err, _req, res, next) => {
  if (err instanceof InvalidMediaError) {
    res.status(415).json({ error: "invalid_media", allowed: MEDIA_MIME_TYPES });
  } else if (err?.type === "entity.too.large") {
    res.status(413).json({ error: "file_too_large", maxBytes: MAX_MEDIA_BYTES });
  } else {
    next(err);
  }
};

export function createMediaUploadRouter({ auth, media, redis }: MediaRouterDeps): Router {
  const router = Router();

  router.post(
    "/",
    requireAuth(auth),
    rateLimit(redis, { name: "media-upload", limit: 60, windowS: 600 }),
    express.raw({ type: MEDIA_MIME_TYPES, limit: MAX_MEDIA_BYTES }),
    async (req, res) => {
      const body: unknown = req.body;
      const content = Buffer.isBuffer(body) ? body : Buffer.alloc(0);
      const declaredType = req.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
      const stored = await media.upload(declaredType, content);
      res.status(201).json({ media: stored });
    },
  );

  router.use(onUploadError);
  return router;
}

export function createMediaServeRouter({ media }: Pick<MediaRouterDeps, "media">): Router {
  const router = Router();

  router.get("/:key", async (req, res) => {
    const stored = await media.download(req.params.key);
    res.set({
      "Content-Type": stored.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    });
    if (stored.contentLength !== undefined) {
      res.set("Content-Length", String(stored.contentLength));
    }
    await pipeline(stored.body, res);
  });

  router.use(((err, _req, res, next) => {
    if (err instanceof MediaNotFoundError) {
      res.status(404).json({ error: "not_found" });
    } else {
      next(err);
    }
  }) satisfies ErrorRequestHandler);

  return router;
}
