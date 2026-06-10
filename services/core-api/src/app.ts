import cors from "cors";
import express, { ErrorRequestHandler } from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { healthRouter } from "./api/routes/health.routes";
import { infoRouter } from "./api/routes/info.routes";
import { platformRouter } from "./api/routes/platform.routes";
import { logger } from "./infrastructure/logging/logger";
import { httpRequestsTotal } from "./infrastructure/metrics/registry";
import { HttpError } from "./shared/http/errors";

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(pinoHttp({ logger }));

  app.use((req, res, next) => {
    res.on("finish", () => {
      httpRequestsTotal.inc({
        method: req.method,
        route: req.route?.path?.toString() ?? req.path,
        status_code: String(res.statusCode)
      });
    });
    next();
  });

  app.use(healthRouter);
  app.use(infoRouter);
  app.use(platformRouter);

  app.use((_req, res) => {
    res.status(404).json({ status: "error", message: "Route not found" });
  });

  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ status: "error", message: error.message, details: error.details });
      return;
    }

    logger.error({ error }, "Unhandled request error");
    res.status(500).json({ status: "error", message: "Internal server error" });
  };

  app.use(errorHandler);
  return app;
};

