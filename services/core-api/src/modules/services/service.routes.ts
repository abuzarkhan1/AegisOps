import { Router } from "express";
import { asyncHandler } from "../../shared/http/asyncHandler";
import { notFound } from "../../shared/http/errors";
import { healthStatus, optionalString, requiredString, serviceType } from "../../shared/http/requestValidation";
import { platformRepository } from "../platform/repositories/platform.repository";
import { cache } from "../../infrastructure/redis/cache";
import { redisKeyPatterns } from "../../utils/cacheKeys";

export const serviceRouter = Router();
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

    const services = await platformRepository.listServices(projectId);
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

    res.status(204).send();
  })
);
