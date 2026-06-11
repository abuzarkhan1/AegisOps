import { Router } from "express";
import { apiKeyRouter } from "../../modules/api-keys/api-key.routes";
import { auditLogRouter } from "../../modules/audit-logs/audit-log.routes";
import { authRouter } from "../../modules/auth/auth.routes";
import { alertRuleRouter } from "../../modules/alert-rules/alert-rule.routes";
import { dashboardRouter } from "../../modules/dashboard/dashboard.routes";
import { incidentRouter } from "../../modules/incidents/incident.routes";
import { organizationRouter } from "../../modules/organizations/organization.routes";
import { projectRouter } from "../../modules/projects/project.routes";
import { reportRouter } from "../../modules/reports/report.routes";
import { serviceRouter } from "../../modules/services/service.routes";
import { systemRouter } from "../../modules/system/system.routes";
import { logsRouter } from "../../modules/system/logs.routes";
import { telemetryRouter } from "../../modules/system/telemetry.routes";
import { requireOrganizationContext } from "../../shared/http/requireOrganizationContext";

export const platformRouter = Router();

platformRouter.use("/api/auth", authRouter);

// Enforce organization scoping and tenant isolation on all platform endpoints
platformRouter.use(requireOrganizationContext);

platformRouter.use("/api/organizations", organizationRouter);
platformRouter.use("/api/v1/projects", projectRouter);
platformRouter.use("/api/v1", serviceRouter);
platformRouter.use("/api/v1", apiKeyRouter);
platformRouter.use("/api/projects", projectRouter);
platformRouter.use("/api", serviceRouter);
platformRouter.use("/api", apiKeyRouter);
platformRouter.use("/api/incidents", incidentRouter);
platformRouter.use("/api/alert-rules", alertRuleRouter);
platformRouter.use("/api/dashboard", dashboardRouter);
platformRouter.use("/api", reportRouter);
platformRouter.use("/api/audit-logs", auditLogRouter);
platformRouter.use("/api", systemRouter);
platformRouter.use("/api", logsRouter);
platformRouter.use("/api", telemetryRouter);
