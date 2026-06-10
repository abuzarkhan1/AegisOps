import { Router } from "express";
import { asyncHandler } from "../../shared/http/asyncHandler";
import { platformRepository } from "../platform/repositories/platform.repository";

export const auditLogRouter = Router();

auditLogRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json({ auditLogs: await platformRepository.listAuditLogs() });
  })
);
