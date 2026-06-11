import { Router } from "express";
import { asyncHandler } from "../../shared/http/asyncHandler";
import { platformRepository } from "../platform/repositories/platform.repository";

export const auditLogRouter = Router();

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

auditLogRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const queryString = (key: string) => (typeof req.query[key] === "string" && req.query[key] ? String(req.query[key]) : undefined);
    const queryUuid = (key: string) => {
      const value = queryString(key);
      return value && uuidPattern.test(value) ? value : undefined;
    };
    const limit = queryString("limit") ? Number(queryString("limit")) : undefined;
    res.json({
      auditLogs: await platformRepository.listAuditLogs({
        organizationId: queryUuid("organizationId"),
        actorId: queryUuid("actorId") ?? queryUuid("actor"),
        action: queryString("action"),
        resourceType: queryString("resourceType"),
        resourceId: queryUuid("resourceId"),
        status: queryString("status"),
        from: queryString("from"),
        to: queryString("to"),
        limit: Number.isFinite(limit) ? limit : undefined
      })
    });
  })
);
