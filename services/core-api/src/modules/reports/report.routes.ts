import { Router } from "express";
import { platformRepository } from "../platform/repositories/platform.repository";
import type { ReportType } from "../platform/types/platform.types";
import { asyncHandler } from "../../shared/http/asyncHandler";
import { HttpError } from "../../shared/http/errors";

export const reportRouter = Router();

const reportTypes: ReportType[] = [
  "daily_reliability",
  "weekly_reliability",
  "incident_report",
  "sla_report",
  "service_health",
  "deployment_impact",
  "ai_postmortem",
  "project_monitoring"
];

const stringValue = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);
const numberValue = (value: unknown) => {
  const parsed = typeof value === "string" ? Number(value) : typeof value === "number" ? value : undefined;
  return Number.isFinite(parsed) ? parsed : undefined;
};

const reportTypeValue = (value: unknown): ReportType => {
  if (typeof value === "string" && reportTypes.includes(value as ReportType)) {
    return value as ReportType;
  }
  throw new HttpError(400, "reportType is invalid");
};

const defaultPeriod = (reportType: ReportType) => {
  const end = new Date();
  const days = reportType === "weekly_reliability" ? 7 : reportType === "daily_reliability" ? 1 : 7;
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { periodStart: start.toISOString(), periodEnd: end.toISOString() };
};

reportRouter.get(
  "/reports",
  asyncHandler(async (req, res) => {
    const organizationId = stringValue(req.query.organizationId);
    const reportType = stringValue(req.query.reportType);
    res.json({
      reports: await platformRepository.listReports({
        organizationId,
        projectId: stringValue(req.query.projectId),
        serviceId: stringValue(req.query.serviceId),
        reportType: reportType && reportTypes.includes(reportType as ReportType) ? (reportType as ReportType) : undefined,
        limit: numberValue(req.query.limit)
      })
    });
  })
);

reportRouter.get(
  "/reports/:reportId",
  asyncHandler(async (req, res) => {
    const report = await platformRepository.getReport(req.params.reportId, stringValue(req.query.organizationId));
    if (!report) throw new HttpError(404, "Report not found");
    res.json({ report });
  })
);

reportRouter.post(
  "/reports/generate",
  asyncHandler(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const reportType = reportTypeValue(body.reportType ?? "weekly_reliability");
    const period = defaultPeriod(reportType);
    const organizationId = stringValue(body.organizationId) ?? stringValue(req.query.organizationId);
    if (!organizationId) throw new HttpError(400, "organizationId is required");
    const report = await platformRepository.generateReliabilityReport({
      organizationId,
      projectId: stringValue(body.projectId),
      serviceId: stringValue(body.serviceId),
      environment: stringValue(body.environment),
      reportType,
      periodStart: stringValue(body.periodStart) ?? period.periodStart,
      periodEnd: stringValue(body.periodEnd) ?? period.periodEnd,
      generatedBy: (req as any).user?.id
    });
    res.status(201).json({ report });
  })
);
