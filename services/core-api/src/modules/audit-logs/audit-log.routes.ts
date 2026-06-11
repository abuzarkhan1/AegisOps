import { Router } from "express";
import { asyncHandler } from "../../shared/http/asyncHandler";
import { platformRepository } from "../platform/repositories/platform.repository";

export const auditLogRouter = Router();

auditLogRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const organizationId = typeof req.query.organizationId === "string" ? req.query.organizationId : undefined;
    res.json({ auditLogs: await platformRepository.listAuditLogs(organizationId) });
  })
);
