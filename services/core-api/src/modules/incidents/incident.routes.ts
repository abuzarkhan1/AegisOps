import { Router } from "express";
import { asyncHandler } from "../../shared/http/asyncHandler";
import { notFound } from "../../shared/http/errors";
import { incidentStatus, optionalString, requiredString, severity } from "../../shared/http/requestValidation";
import { platformRepository } from "../platform/repositories/platform.repository";
import { cache } from "../../infrastructure/redis/cache";
import { redisKeyPatterns } from "../../utils/cacheKeys";
import { publishDomainEvent } from "../../infrastructure/kafka/producer";

export const incidentRouter = Router();

import { clearDashboardCache, clearProjectCache, clearServiceCache } from "../../utils/cacheInvalidation";

async function invalidateIncidentCaches(orgId?: string, incidentId?: string, projectId?: string, serviceId?: string) {
  try {
    await cache.delete(redisKeyPatterns.orgRecentIncidents("default"));
    await cache.delete(redisKeyPatterns.orgDashboardSummary("default"));

    if (orgId) {
      await cache.delete(redisKeyPatterns.orgRecentIncidents(orgId));
      await cache.delete(redisKeyPatterns.orgDashboardSummary(orgId));
      await clearDashboardCache(orgId);
      await clearProjectCache(projectId, orgId);
      await clearServiceCache(serviceId, orgId);
    }
    if (incidentId) {
      await cache.delete(redisKeyPatterns.incidentSummary(incidentId));
    }
  } catch (error) {
    // ignore
  }
}

incidentRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({
      incidents: await platformRepository.listIncidents({
        organizationId: typeof req.query.organizationId === "string" ? req.query.organizationId : undefined,
        projectId: typeof req.query.projectId === "string" ? req.query.projectId : undefined,
        serviceId: typeof req.query.serviceId === "string" ? req.query.serviceId : undefined,
        status: incidentStatus(req.query.status)
      })
    });
  })
);

incidentRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const orgId = requiredString(req.body, "organizationId");
    const incident = await platformRepository.createIncident({
      organizationId: orgId,
      projectId: optionalString(req.body, "projectId"),
      serviceId: optionalString(req.body, "serviceId"),
      title: requiredString(req.body, "title"),
      severity: severity(req.body.severity),
      summary: optionalString(req.body, "summary") ?? optionalString(req.body, "description")
    });
    await platformRepository.audit({
      organizationId: incident.organizationId,
      action: "incident.created",
      resourceType: "incident",
      resourceId: incident.id,
      metadata: { severity: incident.severity, serviceId: incident.serviceId }
    });

    await invalidateIncidentCaches(orgId, incident.id, incident.projectId, incident.serviceId);
    await publishDomainEvent(
      "incidents.created",
      {
        organizationId: incident.organizationId,
        projectId: incident.projectId,
        serviceId: incident.serviceId,
        incidentId: incident.id,
        id: incident.id,
        title: incident.title,
        summary: incident.summary,
        severity: incident.severity,
        status: incident.status
      },
      incident.id
    );

    res.status(201).json({ incident });
  })
);
incidentRouter.get(
  "/:incidentId",
  asyncHandler(async (req, res) => {
    const incidentId = req.params.incidentId;
    const cacheKey = redisKeyPatterns.incidentSummary(incidentId);
    const cached = await cache.get<any>(cacheKey);
    if (cached) {
      res.json({ incident: cached });
      return;
    }
    const incident = await platformRepository.getIncident(incidentId);
    if (!incident) throw notFound("Incident");
    await cache.set(cacheKey, incident, 120); // 2 mins TTL
    res.json({ incident });
  })
);
incidentRouter.patch(
  "/:incidentId",
  asyncHandler(async (req, res) => {
    const incidentId = req.params.incidentId;
    const incident = await platformRepository.updateIncident(incidentId, {
      title: optionalString(req.body, "title"),
      severity: req.body.severity ? severity(req.body.severity) : undefined,
      status: incidentStatus(req.body.status),
      assigneeId: optionalString(req.body, "assigneeId") ?? optionalString(req.body, "assignedTo"),
      summary: optionalString(req.body, "summary") ?? optionalString(req.body, "description")
    });
    if (!incident) throw notFound("Incident");
    await platformRepository.audit({
      organizationId: incident.organizationId,
      action: "incident.updated",
      resourceType: "incident",
      resourceId: incident.id,
      metadata: { status: incident.status, severity: incident.severity }
    });

    await invalidateIncidentCaches(incident.organizationId, incidentId, incident.projectId, incident.serviceId);
    await publishDomainEvent(
      incident.status === "resolved" ? "incidents.resolved" : "incidents.updated",
      {
        organizationId: incident.organizationId,
        projectId: incident.projectId,
        serviceId: incident.serviceId,
        incidentId: incident.id,
        id: incident.id,
        title: incident.title,
        summary: incident.summary,
        severity: incident.severity,
        status: incident.status,
        assigneeId: incident.assigneeId
      },
      incident.id
    );

    res.json({ incident });
  })
);

incidentRouter.post(
  "/:incidentId/assign",
  asyncHandler(async (req, res) => {
    const incidentId = req.params.incidentId;
    const incident = await platformRepository.updateIncident(incidentId, {
      assigneeId: requiredString(req.body, "userId"),
      status: "investigating"
    });
    if (!incident) throw notFound("Incident");
    await platformRepository.audit({
      organizationId: incident.organizationId,
      action: "incident.assigned",
      resourceType: "incident",
      resourceId: incident.id,
      metadata: { assigneeId: incident.assigneeId }
    });

    await invalidateIncidentCaches(incident.organizationId, incidentId, incident.projectId, incident.serviceId);
    await publishDomainEvent(
      "incidents.updated",
      {
        organizationId: incident.organizationId,
        projectId: incident.projectId,
        serviceId: incident.serviceId,
        incidentId: incident.id,
        id: incident.id,
        title: incident.title,
        severity: incident.severity,
        status: incident.status,
        assigneeId: incident.assigneeId
      },
      incident.id
    );

    res.json({ incident });
  })
);

incidentRouter.post(
  "/:incidentId/resolve",
  asyncHandler(async (req, res) => {
    const incidentId = req.params.incidentId;
    const incident = await platformRepository.updateIncident(incidentId, { status: "resolved" });
    if (!incident) throw notFound("Incident");
    await platformRepository.audit({
      organizationId: incident.organizationId,
      action: "incident.resolved",
      resourceType: "incident",
      resourceId: incident.id
    });

    await invalidateIncidentCaches(incident.organizationId, incidentId, incident.projectId, incident.serviceId);
    await publishDomainEvent(
      "incidents.resolved",
      {
        organizationId: incident.organizationId,
        projectId: incident.projectId,
        serviceId: incident.serviceId,
        incidentId: incident.id,
        id: incident.id,
        title: incident.title,
        severity: incident.severity,
        status: incident.status
      },
      incident.id
    );

    res.json({ incident });
  })
);

incidentRouter.get(
  "/:incidentId/timeline",
  asyncHandler(async (req, res) => {
    res.json({ incidentId: req.params.incidentId, timeline: await platformRepository.listIncidentTimeline(req.params.incidentId) });
  })
);

incidentRouter.get(
  "/:incidentId/ai-analysis",
  asyncHandler(async (req, res) => {
    const analysis = await platformRepository.listAiAnalysis(req.params.incidentId);
    res.json({ incidentId: req.params.incidentId, status: analysis.length > 0 ? "complete" : "pending", analysis });
  })
);

incidentRouter.post(
  "/:incidentId/ai-analysis",
  asyncHandler(async (req, res) => {
    const analysis = await platformRepository.createAiAnalysisResult({
      incidentId: req.params.incidentId,
      summary: requiredString(req.body, "summary"),
      likelyRootCause: requiredString(req.body, "likelyRootCause"),
      confidenceScore: typeof req.body.confidenceScore === "number" ? req.body.confidenceScore : 0.5,
      evidence: Array.isArray(req.body.evidence) ? req.body.evidence : [],
      recommendedActions: Array.isArray(req.body.recommendedActions) ? req.body.recommendedActions : [],
      rollbackRecommendation: optionalString(req.body, "rollbackRecommendation"),
      postmortemDraft: optionalString(req.body, "postmortemDraft")
    });
    res.status(201).json({ incidentId: req.params.incidentId, analysis });
  })
);
