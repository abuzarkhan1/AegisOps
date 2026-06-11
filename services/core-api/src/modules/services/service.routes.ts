import { Router } from "express";
import { asyncHandler } from "../../shared/http/asyncHandler";
import { notFound } from "../../shared/http/errors";
import { healthStatus, optionalString, requiredString, serviceType } from "../../shared/http/requestValidation";
import { platformRepository } from "../platform/repositories/platform.repository";
import { cache } from "../../infrastructure/redis/cache";
import { redisKeyPatterns } from "../../utils/cacheKeys";
import { clearServiceCache, clearProjectCache } from "../../utils/cacheInvalidation";

export const serviceRouter = Router();

const queryString = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

serviceRouter.get(
  "/projects/:projectId/services",
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId;
    const project = await platformRepository.getProject(projectId);
    if (!project) throw notFound("Project");

    const orgId = project.organizationId;
    const cacheKey = `${redisKeyPatterns.orgServices(orgId)}:project:${projectId}`;
    const cached = await cache.get<any>(cacheKey);
    if (cached) {
      res.json({ services: cached });
      return;
    }

    const services = await platformRepository.listServices(projectId, orgId);
    await cache.set(cacheKey, services, 300); // 5 mins TTL
    res.json({ services });
  })
);

serviceRouter.post(
  "/projects/:projectId/services",
  asyncHandler(async (req, res) => {
    const project = await platformRepository.getProject(req.params.projectId);
    if (!project) throw notFound("Project");
    const service = await platformRepository.createService({
      organizationId: project.organizationId,
      projectId: project.id,
      name: requiredString(req.body, "name"),
      environment: optionalString(req.body, "environment") ?? project.environment,
      serviceType: serviceType(req.body.serviceType),
      language: optionalString(req.body, "language"),
      repositoryUrl: optionalString(req.body, "repositoryUrl")
    });
    await platformRepository.audit({
      organizationId: service.organizationId,
      action: "service.created",
      resourceType: "service",
      resourceId: service.id,
      metadata: { projectId: project.id, serviceType: service.serviceType }
    });

    // Invalidate caches
    await cache.delete(redisKeyPatterns.orgServices(service.organizationId));
    await cache.delete(`${redisKeyPatterns.orgServices(service.organizationId)}:project:${project.id}`);
    await clearProjectCache(project.id, service.organizationId);

    res.status(201).json({ service });
  })
);

serviceRouter.get(
  "/services/:serviceId",
  asyncHandler(async (req, res) => {
    const serviceId = req.params.serviceId;
    const cacheKey = redisKeyPatterns.serviceConfig(serviceId);
    const cached = await cache.get<any>(cacheKey);
    if (cached) {
      res.json({ service: cached });
      return;
    }
    const service = await platformRepository.getService(serviceId);
    if (!service) throw notFound("Service");
    await cache.set(cacheKey, service, 300); // 5 mins TTL
    res.json({ service });
  })
);

serviceRouter.get(
  "/services/:serviceId/detail-summary",
  asyncHandler(async (req, res) => {
    const serviceId = req.params.serviceId;
    const service = await platformRepository.getService(serviceId);
    if (!service) throw notFound("Service");

    const organizationId = queryString(req.query.organizationId) ?? service.organizationId;
    const environment = queryString(req.query.environment);
    const from = queryString(req.query.from);
    const to = queryString(req.query.to);
    const cacheKey = `service:${service.id}:detail-summary:${organizationId}:${environment ?? "all"}:${from ?? "default"}:${to ?? "now"}`;
    const cached = await cache.get<any>(cacheKey);
    if (cached) {
      res.json({ summary: cached });
      return;
    }

    const summary = await platformRepository.serviceDetailSummary({
      organizationId,
      serviceId: service.id,
      environment,
      from,
      to
    });
    await cache.set(cacheKey, summary, 30);
    res.json({ summary });
  })
);

serviceRouter.get(
  "/services/:serviceId/connection-status",
  asyncHandler(async (req, res) => {
    const service = await platformRepository.getService(req.params.serviceId);
    if (!service) throw notFound("Service");

    const status = await platformRepository.getServiceConnectionStatus(service.id, service.organizationId);
    res.json(status);
  })
);

serviceRouter.post(
  "/services/:serviceId/test-event",
  asyncHandler(async (req, res) => {
    const service = await platformRepository.getService(req.params.serviceId);
    if (!service) throw notFound("Service");
    const project = await platformRepository.getProject(service.projectId);
    if (!project) throw notFound("Project");

    const event = await platformRepository.createServiceTestTelemetry({ project, service });
    await platformRepository.audit({
      organizationId: service.organizationId,
      action: "service.test_event_created",
      resourceType: "service",
      resourceId: service.id,
      metadata: { projectId: project.id, logId: event.logId, metricIds: event.metricIds }
    });
    await clearServiceCache(service.id, service.organizationId);
    await clearProjectCache(project.id, service.organizationId);

    const connectionStatus = await platformRepository.getServiceConnectionStatus(service.id, service.organizationId);
    res.status(201).json({ event, connectionStatus });
  })
);

serviceRouter.patch(
  "/services/:serviceId",
  asyncHandler(async (req, res) => {
    const serviceId = req.params.serviceId;
    const existingService = await platformRepository.getService(serviceId);
    if (!existingService) throw notFound("Service");

    const service = await platformRepository.updateService(serviceId, {
      name: optionalString(req.body, "name"),
      environment: optionalString(req.body, "environment"),
      serviceType: serviceType(req.body.serviceType),
      language: optionalString(req.body, "language"),
      repositoryUrl: optionalString(req.body, "repositoryUrl"),
      healthStatus: healthStatus(req.body.healthStatus)
    });
    if (!service) throw notFound("Service");
    await platformRepository.audit({
      organizationId: service.organizationId,
      action: "service.updated",
      resourceType: "service",
      resourceId: service.id
    });

    // Invalidate caches
    await cache.delete(redisKeyPatterns.orgServices(service.organizationId));
    await cache.delete(`${redisKeyPatterns.orgServices(service.organizationId)}:project:${service.projectId}`);
    await cache.delete(redisKeyPatterns.serviceConfig(serviceId));
    await clearServiceCache(serviceId, service.organizationId);
    await clearProjectCache(service.projectId, service.organizationId);

    res.json({ service });
  })
);

serviceRouter.delete(
  "/services/:serviceId",
  asyncHandler(async (req, res) => {
    const serviceId = req.params.serviceId;
    const service = await platformRepository.getService(serviceId);
    if (!service || !(await platformRepository.deleteService(serviceId))) throw notFound("Service");
    await platformRepository.audit({
      organizationId: service.organizationId,
      action: "service.deleted",
      resourceType: "service",
      resourceId: service.id
    });

    // Invalidate caches
    await cache.delete(redisKeyPatterns.orgServices(service.organizationId));
    await cache.delete(`${redisKeyPatterns.orgServices(service.organizationId)}:project:${service.projectId}`);
    await cache.delete(redisKeyPatterns.serviceConfig(serviceId));
    await clearServiceCache(serviceId, service.organizationId);
    await clearProjectCache(service.projectId, service.organizationId);

    res.status(204).send();
  })
);
