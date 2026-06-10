import express from "express";
import pinoHttp from "pino-http";
import { healthRouter } from "./api/routes/health.routes";
import { logger } from "./infrastructure/logging/logger";

export const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use(pinoHttp({ logger }));
  app.use(healthRouter);
  return app;
};

