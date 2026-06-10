import { Router } from "express";
import { asyncHandler } from "../../shared/http/asyncHandler";
import { platformRepository } from "../platform/repositories/platform.repository";

export const logsRouter = Router();

logsRouter.get(
  "/logs",
  asyncHandler(async (req, res) => {
    const serviceName = typeof req.query.serviceName === "string" ? req.query.serviceName : undefined;
    const organizationId = typeof req.query.organizationId === "string" ? req.query.organizationId : undefined;
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    const serviceId = typeof req.query.serviceId === "string" ? req.query.serviceId : undefined;
    const projectKey = typeof req.query.projectKey === "string" ? req.query.projectKey : undefined;
    const level = typeof req.query.level === "string" ? req.query.level : undefined;
    const environment = typeof req.query.environment === "string" ? req.query.environment : undefined;
    const traceId = typeof req.query.traceId === "string" ? req.query.traceId : undefined;
    const requestId = typeof req.query.requestId === "string" ? req.query.requestId : undefined;
    const route = typeof req.query.route === "string" ? req.query.route : undefined;
    const statusCode = typeof req.query.statusCode === "string" ? Number(req.query.statusCode) : undefined;
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : undefined;

    const logs = await platformRepository.listLogs({
      organizationId,
      projectId,
      serviceId,
      projectKey,
      serviceName,
      level,
      environment,
      traceId,
      requestId,
      route,
      statusCode: Number.isFinite(statusCode) ? statusCode : undefined,
      from,
      to,
      search,
      limit: isNaN(limit as number) ? undefined : limit
    });

    res.json({ logs });
  })
);
