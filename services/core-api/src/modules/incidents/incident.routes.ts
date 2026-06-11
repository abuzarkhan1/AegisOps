import { Router } from "express";
import { asyncHandler } from "../../shared/http/asyncHandler";
import { notFound } from "../../shared/http/errors";
import { incidentStatus, optionalObject, optionalString, requiredString, severity } from "../../shared/http/requestValidation";
import { platformRepository } from "../platform/repositories/platform.repository";
import { cache } from "../../infrastructure/redis/cache";
import { redisKeyPatterns } from "../../utils/cacheKeys";
import { publishDomainEvent } from "../../infrastructure/kafka/producer";
import type { Incident, IncidentStatus } from "../platform/types/platform.types";

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

async function publishIncidentStateChange(topic: "incidents.updated" | "incidents.resolved", incident: Incident, metadata?: Record<string, unknown>) {
  await publishDomainEvent(
    topic,
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
      assigneeId: incident.assigneeId,
      ...metadata
    },
    incident.id
  );
}

async function transitionIncident(input: {
  incidentId: string;
  status: IncidentStatus;
  action: string;
  eventType: string;
  message: string;
  note?: string;
  assigneeId?: string;
  topic?: "incidents.updated" | "incidents.resolved";
}) {
  const incident = await platformRepository.updateIncident(input.incidentId, {
    status: input.status,
    assigneeId: input.assigneeId
  });
  if (!incident) throw notFound("Incident");

  await platformRepository.createIncidentTimelineEvent({
    incidentId: incident.id,
    eventType: input.eventType,
    message: input.note ? `${input.message}: ${input.note}` : input.message,
    metadata: { status: incident.status, note: input.note, assigneeId: incident.assigneeId }
  });
  await platformRepository.audit({
    organizationId: incident.organizationId,
    action: input.action,
    resourceType: "incident",
    resourceId: incident.id,
    metadata: { status: incident.status, note: input.note, assigneeId: incident.assigneeId }
  });

  await invalidateIncidentCaches(incident.organizationId, incident.id, incident.projectId, incident.serviceId);
  await publishIncidentStateChange(input.topic ?? "incidents.updated", incident, { note: input.note });

  return incident;
}

function postmortemText(input: {
  incident: Incident;
  timeline: Array<{ eventType: string; message: string; createdAt?: string }>;
  evidence: Array<{ evidenceType: string; title?: string; payload?: Record<string, unknown>; createdAt?: string }>;
  analysis?: {
    summary?: string;
    likelyRootCause?: string;
    evidence?: string[];
    recommendedActions?: string[];
    rollbackRecommendation?: string;
  };
}) {
  const { incident, timeline, evidence, analysis } = input;
  const timelineLines = timeline.length
    ? timeline.map((item) => `- ${item.createdAt ?? "unknown"} - ${item.eventType}: ${item.message}`)
    : ["- No timeline events captured."];
  const evidenceLines = evidence.length
    ? evidence.slice(0, 12).map((item) => {
        const payload = item.payload ? JSON.stringify(item.payload).slice(0, 240) : "{}";
        return `- ${item.evidenceType}: ${item.title ?? "Untitled evidence"} - ${payload}`;
      })
    : ["- No structured evidence attached."];
  const aiEvidence = Array.isArray(analysis?.evidence) && analysis.evidence.length > 0 ? analysis.evidence : ["Pending AI evidence."];
  const actions =
    Array.isArray(analysis?.recommendedActions) && analysis.recommendedActions.length > 0
      ? analysis.recommendedActions
      : ["Review telemetry, validate mitigation, and add prevention follow-up."];

  return [
    `# Incident Postmortem: ${incident.title}`,
    "",
    "## Summary",
    analysis?.summary ?? incident.summary ?? "Incident summary pending final engineer review.",
    "",
    "## Impact",
    `Severity: ${incident.severity}`,
    `Status: ${incident.status}`,
    `Started: ${incident.createdAt}`,
    `Resolved: ${incident.resolvedAt ?? "Unresolved"}`,
    "",
    "## Root Cause",
    analysis?.likelyRootCause ?? "Pending final engineer review.",
    "",
    "## Timeline",
    ...timelineLines,
    "",
    "## Evidence",
    ...evidenceLines,
    "",
    "## AI Evidence",
    ...aiEvidence.map((item) => `- ${item}`),
    "",
    "## Corrective Actions",
    ...actions.map((item) => `- ${item}`),
    "",
    "## Rollback Recommendation",
    analysis?.rollbackRecommendation ?? "No rollback recommendation recorded.",
    ""
  ].join("\n");
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
    const incident = await transitionIncident({
      incidentId: req.params.incidentId,
      status: "resolved",
      action: "incident.resolved",
      eventType: "resolved",
      message: "Incident resolved",
      note: optionalString(req.body, "note") ?? optionalString(req.body, "resolution"),
      topic: "incidents.resolved"
    });
    res.json({ incident });
  })
);

incidentRouter.post(
  "/:incidentId/acknowledge",
  asyncHandler(async (req, res) => {
    const incident = await transitionIncident({
      incidentId: req.params.incidentId,
      status: "investigating",
      action: "incident.acknowledged",
      eventType: "engineer_acknowledged",
      message: "Engineer acknowledged incident",
      note: optionalString(req.body, "note"),
      assigneeId: optionalString(req.body, "userId") ?? optionalString(req.body, "assigneeId")
    });
    res.json({ incident });
  })
);

incidentRouter.post(
  "/:incidentId/identify",
  asyncHandler(async (req, res) => {
    const incident = await transitionIncident({
      incidentId: req.params.incidentId,
      status: "identified",
      action: "incident.identified",
      eventType: "root_cause_identified",
      message: "Root cause identified",
      note: optionalString(req.body, "note") ?? optionalString(req.body, "summary")
    });
    res.json({ incident });
  })
);

incidentRouter.post(
  "/:incidentId/monitor",
  asyncHandler(async (req, res) => {
    const incident = await transitionIncident({
      incidentId: req.params.incidentId,
      status: "monitoring",
      action: "incident.monitoring",
      eventType: "monitoring",
      message: "Incident mitigation is being monitored",
      note: optionalString(req.body, "note")
    });
    res.json({ incident });
  })
);

incidentRouter.post(
  "/:incidentId/reopen",
  asyncHandler(async (req, res) => {
    const incident = await transitionIncident({
      incidentId: req.params.incidentId,
      status: "open",
      action: "incident.reopened",
      eventType: "reopened",
      message: "Incident reopened",
      note: optionalString(req.body, "note")
    });
    res.json({ incident });
  })
);

incidentRouter.post(
  "/:incidentId/close",
  asyncHandler(async (req, res) => {
    const incident = await transitionIncident({
      incidentId: req.params.incidentId,
      status: "closed",
      action: "incident.closed",
      eventType: "closed",
      message: "Incident closed",
      note: optionalString(req.body, "note")
    });
    res.json({ incident });
  })
);

incidentRouter.get(
  "/:incidentId/evidence",
  asyncHandler(async (req, res) => {
    const incident = await platformRepository.getIncident(req.params.incidentId);
    if (!incident) throw notFound("Incident");
    res.json({ incidentId: incident.id, evidence: await platformRepository.listIncidentEvidence(incident.id) });
  })
);

incidentRouter.post(
  "/:incidentId/evidence",
  asyncHandler(async (req, res) => {
    const incident = await platformRepository.getIncident(req.params.incidentId);
    if (!incident) throw notFound("Incident");
    const evidence = await platformRepository.createIncidentEvidence({
      incidentId: incident.id,
      evidenceType: requiredString(req.body, "evidenceType"),
      sourceId: optionalString(req.body, "sourceId"),
      title: optionalString(req.body, "title"),
      payload: optionalObject(req.body, "payload")
    });
    await platformRepository.createIncidentTimelineEvent({
      incidentId: incident.id,
      eventType: "evidence_added",
      message: `Evidence added: ${evidence.title ?? evidence.evidenceType}`,
      metadata: { evidenceId: evidence.id, evidenceType: evidence.evidenceType, sourceId: evidence.sourceId }
    });
    await platformRepository.audit({
      organizationId: incident.organizationId,
      action: "incident.evidence.added",
      resourceType: "incident",
      resourceId: incident.id,
      metadata: { evidenceId: evidence.id, evidenceType: evidence.evidenceType }
    });
    await invalidateIncidentCaches(incident.organizationId, incident.id, incident.projectId, incident.serviceId);
    res.status(201).json({ incidentId: incident.id, evidence });
  })
);

incidentRouter.post(
  "/:incidentId/postmortem",
  asyncHandler(async (req, res) => {
    const incident = await platformRepository.getIncident(req.params.incidentId);
    if (!incident) throw notFound("Incident");
    const [timeline, evidence, analysis] = await Promise.all([
      platformRepository.listIncidentTimeline(incident.id),
      platformRepository.listIncidentEvidence(incident.id),
      platformRepository.listAiAnalysis(incident.id)
    ]);
    const draft = postmortemText({ incident, timeline, evidence, analysis: analysis[0] });
    const savedAnalysis = await platformRepository.saveIncidentPostmortemDraft({
      incidentId: incident.id,
      postmortemDraft: draft,
      summary: analysis[0]?.summary ?? incident.summary ?? incident.title,
      likelyRootCause: analysis[0]?.likelyRootCause,
      evidence: analysis[0]?.evidence,
      recommendedActions: analysis[0]?.recommendedActions
    });
    await platformRepository.createIncidentTimelineEvent({
      incidentId: incident.id,
      eventType: "postmortem_generated",
      message: "Postmortem draft generated from current timeline, evidence, and AI analysis.",
      metadata: { analysisId: savedAnalysis.id, evidenceCount: evidence.length, timelineCount: timeline.length }
    });
    await platformRepository.audit({
      organizationId: incident.organizationId,
      action: "incident.postmortem.generated",
      resourceType: "incident",
      resourceId: incident.id,
      metadata: { analysisId: savedAnalysis.id }
    });
    res.json({ incidentId: incident.id, postmortemDraft: draft, analysis: savedAnalysis });
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
