import express, { type ErrorRequestHandler, type Express } from "express";
import { healthRouter } from "./http/health.js";

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", true);
  app.use(express.json({ limit: "1mb" }));

  app.use("/api", healthRouter);

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  const onError: ErrorRequestHandler = (err, _req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    console.error(err);
    res.status(500).json({ error: "internal_error" });
  };
  app.use(onError);

  return app;
}
