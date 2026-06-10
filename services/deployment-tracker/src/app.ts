import cors from "cors";
import express, { ErrorRequestHandler } from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { deploymentRouter } from "./api/routes/deployment.routes";
import { logger } from "./infrastructure/logging/logger";

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(pinoHttp({ logger }));
  app.use(deploymentRouter);

  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    logger.error({ error }, "Deployment tracker request failed");
    res.status(500).json({ status: "error", message: "Deployment tracker failed" });
  };

  app.use(errorHandler);
  return app;
};

