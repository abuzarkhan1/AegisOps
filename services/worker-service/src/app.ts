import express from "express";
import pinoHttp from "pino-http";
import { healthRouter } from "./api/routes/health.routes";
import { logger } from "./infrastructure/logging/logger";
import { runRollups, runRetention } from "./workflows/jobs";

export const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use(pinoHttp({ logger }));
  app.use(healthRouter);

  app.post("/jobs/rollup", async (req, res) => {
    try {
      const rollups = await runRollups();
      res.json({ status: "success", message: "Rollups executed successfully", rollups });
    } catch (error) {
      logger.error({ error }, "Failed to execute manual rollup job");
      res.status(500).json({ status: "error", message: "Failed to execute rollups" });
    }
  });

  app.post("/jobs/retention", async (req, res) => {
    try {
      const retention = await runRetention();
      res.json({ status: "success", message: "Retention executed successfully", retention });
    } catch (error) {
      logger.error({ error }, "Failed to execute manual retention job");
      res.status(500).json({ status: "error", message: "Failed to execute retention" });
    }
  });

  return app;
};
