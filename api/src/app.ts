import cookieParser from "cookie-parser";
import express, { type ErrorRequestHandler, type Express } from "express";
import type { Pool } from "pg";
import type { Config } from "./config/env.js";
import { createAuthRouter } from "./http/auth.js";
import { healthRouter } from "./http/health.js";
import { createMediaServeRouter, createMediaUploadRouter } from "./http/media.js";
import { createQuizzesRouter } from "./http/quizzes.js";
import type { MediaRepository } from "./repositories/media.js";
import type { RedisClient } from "./repositories/redis.js";
import { createQuizRepository } from "./repositories/quizzes.js";
import { createUserRepository } from "./repositories/users.js";
import { createAuthService } from "./services/auth.js";
import { createMediaService } from "./services/media.js";
import { createQuizService } from "./services/quizzes.js";

interface AppDeps {
  config: Config;
  pool: Pool;
  redis: RedisClient;
  mediaRepository: MediaRepository;
}

export function createApp({ config, pool, redis, mediaRepository }: AppDeps): Express {
  const app = express();
  const auth = createAuthService(createUserRepository(pool), config.JWT_SECRET);
  const quizzes = createQuizService(createQuizRepository(pool));
  const media = createMediaService(mediaRepository);

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.use("/api", healthRouter);
  app.use(
    "/api/auth",
    createAuthRouter({ auth, redis, secureCookies: config.PUBLIC_URL.startsWith("https://") }),
  );
  app.use("/api/quizzes", createQuizzesRouter({ auth, quizzes }));
  app.use("/api/media", createMediaUploadRouter({ auth, media, redis }));
  app.use("/media", createMediaServeRouter({ media }));

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  const onError: ErrorRequestHandler = (err, _req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    const status: unknown = err?.status;
    if (typeof status === "number" && status >= 400 && status < 500) {
      res.status(status).json({ error: "bad_request" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "internal_error" });
  };
  app.use(onError);

  return app;
}
