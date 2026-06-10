import { Router } from "express";
import { asyncHandler } from "../../shared/http/asyncHandler";
import { notFound } from "../../shared/http/errors";
import { optionalString, requiredString } from "../../shared/http/requestValidation";
import { platformRepository } from "../platform/repositories/platform.repository";
import { cache } from "../../infrastructure/redis/cache";
import { redisKeyPatterns } from "../../utils/cacheKeys";

export const projectRouter = Router();
projectRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const orgId = typeof req.query.organizationId === "string" ? req.query.organizationId : undefined;
    const env = typeof req.query.environment === "string" ? req.query.environment : undefined;

    if (orgId) {
      const cacheKey = `${redisKeyPatterns.orgProjects(orgId)}${env ? `:${env}` : ""}`;
      const cached = await cache.get<any>(cacheKey);
      if (cached) {
        res.json({ projects: cached });
        return;
      }
      const projects = await platformRepository.listProjects(env, orgId);
      await cache.set(cacheKey, projects, 300); // 5 mins TTL
      res.json({ projects });
      return;
    }

    res.json({ projects: await platformRepository.listProjects(env) });
  })
);
projectRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const organizationId = requiredString(req.body, "organizationId");
    const project = await platformRepository.createProject({
      organizationId,
      name: requiredString(req.body, "name"),
      projectKey: optionalString(req.body, "projectKey"),
      environment: optionalString(req.body, "environment"),
      description: optionalString(req.body, "description")
    });
    await platformRepository.audit({
      organizationId: project.organizationId,
      action: "project.created",
      resourceType: "project",
      resourceId: project.id
    });

    // Invalidate project list caches
    await cache.delete(redisKeyPatterns.orgProjects(organizationId));
    await cache.delete(`${redisKeyPatterns.orgProjects(organizationId)}:${project.environment}`);

    res.status(201).json({ project });
  })
);

projectRouter.get(
  "/:projectId",
  asyncHandler(async (req, res) => {
    const project = await platformRepository.getProject(req.params.projectId);
    if (!project) throw notFound("Project");
    res.json({ project });
  })
);

projectRouter.patch(
  "/:projectId",
  asyncHandler(async (req, res) => {
    const project = await platformRepository.updateProject(req.params.projectId, {
      name: optionalString(req.body, "name"),
      projectKey: optionalString(req.body, "projectKey"),
      environment: optionalString(req.body, "environment"),
      description: optionalString(req.body, "description")
    });
    if (!project) throw notFound("Project");
    await platformRepository.audit({
      organizationId: project.organizationId,
      action: "project.updated",
      resourceType: "project",
      resourceId: project.id
    });

    // Invalidate project list caches
    await cache.delete(redisKeyPatterns.orgProjects(project.organizationId));
    await cache.delete(`${redisKeyPatterns.orgProjects(project.organizationId)}:${project.environment}`);

    res.json({ project });
  })
);

projectRouter.delete(
  "/:projectId",
  asyncHandler(async (req, res) => {
    const project = await platformRepository.getProject(req.params.projectId);
    if (!project || !(await platformRepository.deleteProject(req.params.projectId))) throw notFound("Project");
    await platformRepository.audit({
      organizationId: project.organizationId,
      action: "project.deleted",
      resourceType: "project",
      resourceId: project.id
    });

    // Invalidate project list caches
    await cache.delete(redisKeyPatterns.orgProjects(project.organizationId));
    await cache.delete(`${redisKeyPatterns.orgProjects(project.organizationId)}:${project.environment}`);

    res.status(204).send();
  })
);
