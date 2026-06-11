import { Router } from "express";
import { asyncHandler } from "../../shared/http/asyncHandler";
import { HttpError, notFound } from "../../shared/http/errors";
import { optionalString, requiredString } from "../../shared/http/requestValidation";
import { cache } from "../../infrastructure/redis/cache";
import { sha256 } from "../../shared/security/crypto";
import { redisKeyPatterns } from "../../utils/cacheKeys";
import { platformRepository } from "../platform/repositories/platform.repository";
import { apiKeyService } from "../platform/services/apiKey.service";

export const apiKeyRouter = Router();

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const apiKeyContextCacheKey = (keyHash: string) => `api-key:${keyHash}:context`;
const publicApiKey = <T extends { keyHash?: string }>(apiKey: T) => {
  const { keyHash: _keyHash, ...publicRecord } = apiKey;
  return publicRecord;
};

const cacheValidationContext = async (
  keyHash: string,
  context: {
    id: string;
    organizationId: string;
    serviceId?: string;
    serviceName?: string;
    environment?: string;
    projectId?: string;
    projectKey?: string;
    prefix: string;
    status: string;
    lastUsedAt?: string;
  }
) => {
  const value = { valid: true, ...context, cachedAt: new Date().toISOString() };
  await cache.set(apiKeyContextCacheKey(keyHash), value, 300);
  await cache.set(redisKeyPatterns.orgApiKey(context.organizationId, keyHash), value, 300);
};

const invalidValidation = (res: any, message: string) => {
  res.json({ valid: false, message });
};

apiKeyRouter.post(
  "/services/:serviceId/api-keys",
  asyncHandler(async (req, res) => {
    const service = await platformRepository.getService(req.params.serviceId);
    if (!service) throw notFound("Service");
    const apiKey = await apiKeyService.create({
      organizationId: service.organizationId,
      serviceId: service.id,
      name: optionalString(req.body, "name") ?? `${service.name} ingestion key`
    });
    await platformRepository.audit({
      organizationId: service.organizationId,
      action: "api_key.created",
      resourceType: "api_key",
      resourceId: apiKey.id,
      metadata: { serviceId: service.id, prefix: apiKey.prefix }
    });
    res.status(201).json({ apiKey: publicApiKey(apiKey) });
  })
);

apiKeyRouter.get(
  "/services/:serviceId/api-keys",
  asyncHandler(async (req, res) => {
    const service = await platformRepository.getService(req.params.serviceId);
    if (!service) throw notFound("Service");
    res.json({ apiKeys: await platformRepository.listApiKeys(service.id, service.organizationId) });
  })
);

apiKeyRouter.post(
  "/api-keys",
  asyncHandler(async (req, res) => {
    const apiKey = await apiKeyService.create({
      organizationId: requiredString(req.body, "organizationId"),
      serviceId: optionalString(req.body, "serviceId"),
      name: requiredString(req.body, "name")
    });
    await platformRepository.audit({
      organizationId: apiKey.organizationId,
      action: "api_key.created",
      resourceType: "api_key",
      resourceId: apiKey.id,
      metadata: { serviceId: apiKey.serviceId, prefix: apiKey.prefix }
    });
    res.status(201).json({ apiKey: publicApiKey(apiKey) });
  })
);

apiKeyRouter.get(
  "/api-keys",
  asyncHandler(async (req, res) => {
    const organizationId = typeof req.query.organizationId === "string" ? req.query.organizationId : undefined;
    const serviceId = typeof req.query.serviceId === "string" ? req.query.serviceId : undefined;
    res.json({ apiKeys: await platformRepository.listApiKeys(serviceId, organizationId) });
  })
);

apiKeyRouter.post(
  "/api-keys/validate",
  asyncHandler(async (req, res) => {
    const rawApiKey = requiredString(req.body, "apiKey");
    const keyHash = sha256(rawApiKey);
    const apiKey = await apiKeyService.validate(rawApiKey);
    if (!apiKey) {
      res.json({ valid: false });
      return;
    }

    const service = apiKey.serviceId ? await platformRepository.getService(apiKey.serviceId) : undefined;
    const project = service?.projectId ? await platformRepository.getProject(service.projectId) : undefined;

    const projectRef = optionalString(req.body, "projectKey") ?? optionalString(req.body, "projectId");
    const requestedServiceId = optionalString(req.body, "serviceId");
    const requestedServiceName = optionalString(req.body, "serviceName");

    const resolveProject = async (ref: string) => {
      const resolved = uuidPattern.test(ref)
        ? await platformRepository.getProject(ref)
        : await platformRepository.getProjectByKey(ref, apiKey.organizationId);
      return resolved?.organizationId === apiKey.organizationId ? resolved : undefined;
    };

    if (apiKey.serviceId) {
      if (!service || !project || service.organizationId !== apiKey.organizationId || project.organizationId !== apiKey.organizationId) {
        invalidValidation(res, "API key is not attached to a valid service context");
        return;
      }

      if (projectRef) {
        const targetProject = await resolveProject(projectRef);
        if (!targetProject || targetProject.id !== project.id) {
          invalidValidation(res, "API key does not have access to this project");
          return;
        }
      }

      if (requestedServiceId && requestedServiceId !== service.id) {
        invalidValidation(res, "API key does not have access to this service");
        return;
      }

      if (requestedServiceName && requestedServiceName !== service.name) {
        invalidValidation(res, "API key does not have access to this service");
        return;
      }
    } else {
      const targetProject = projectRef ? await resolveProject(projectRef) : undefined;
      if (projectRef && !targetProject) {
        invalidValidation(res, "API key does not have access to this project");
        return;
      }

      let targetService = undefined;
      if (requestedServiceId) {
        targetService = await platformRepository.getService(requestedServiceId);
        if (!targetService || targetService.organizationId !== apiKey.organizationId) {
          invalidValidation(res, "API key does not have access to this service");
          return;
        }
        if (targetProject && targetService.projectId !== targetProject.id) {
          invalidValidation(res, "API key service and project context do not match");
          return;
        }
      } else if (requestedServiceName) {
        if (!targetProject) {
          invalidValidation(res, "projectKey or projectId is required when resolving serviceName");
          return;
        }
        targetService = await platformRepository.getServiceByName(targetProject.id, requestedServiceName);
        if (!targetService || targetService.organizationId !== apiKey.organizationId) {
          invalidValidation(res, "API key does not have access to this service");
          return;
        }
      }

      const contextProject = targetProject ?? (targetService ? await platformRepository.getProject(targetService.projectId) : undefined);
      const context = {
        id: apiKey.id,
        organizationId: apiKey.organizationId,
        serviceId: targetService?.id,
        serviceName: targetService?.name,
        environment: targetService?.environment ?? contextProject?.environment,
        projectId: contextProject?.id ?? targetService?.projectId,
        projectKey: contextProject?.projectKey,
        prefix: apiKey.prefix,
        status: apiKey.status,
        lastUsedAt: apiKey.lastUsedAt
      };

      await cacheValidationContext(keyHash, context);
      res.json({ valid: true, apiKey: context });
      return;
    }

    const context = {
      id: apiKey.id,
      organizationId: apiKey.organizationId,
      serviceId: apiKey.serviceId,
      serviceName: service?.name,
      environment: service?.environment ?? project?.environment,
      projectId: service?.projectId,
      projectKey: project?.projectKey,
      prefix: apiKey.prefix,
      status: apiKey.status,
      lastUsedAt: apiKey.lastUsedAt
    };

    await cacheValidationContext(keyHash, context);
    res.json({ valid: true, apiKey: context });
  })
);

apiKeyRouter.delete(
  "/api-keys/:apiKeyId",
  asyncHandler(async (req, res) => {
    const apiKey = await platformRepository.revokeApiKey(req.params.apiKeyId);
    if (!apiKey) throw notFound("API key");
    await cache.delete(apiKeyContextCacheKey(apiKey.keyHash));
    await cache.delete(redisKeyPatterns.orgApiKey(apiKey.organizationId, apiKey.keyHash));
    await platformRepository.audit({
      organizationId: apiKey.organizationId,
      action: "api_key.revoked",
      resourceType: "api_key",
      resourceId: apiKey.id,
      metadata: { prefix: apiKey.prefix }
    });
    res.status(204).send();
  })
);

apiKeyRouter.post(
  "/api-keys/:apiKeyId/rotate",
  asyncHandler(async (req, res) => {
    const existing = await platformRepository.getApiKey(req.params.apiKeyId);
    if (!existing) throw notFound("API key");
    if (existing.status !== "active" || existing.revokedAt) {
      throw new HttpError(409, "Only active API keys can be rotated");
    }

    const rotated = await apiKeyService.rotate(existing);
    if (!rotated) throw new HttpError(409, "API key could not be rotated");

    await cache.delete(apiKeyContextCacheKey(existing.keyHash));
    await cache.delete(redisKeyPatterns.orgApiKey(existing.organizationId, existing.keyHash));
    await platformRepository.audit({
      organizationId: existing.organizationId,
      action: "api_key.rotated",
      resourceType: "api_key",
      resourceId: rotated.apiKey.id,
      metadata: {
        previousApiKeyId: existing.id,
        previousPrefix: existing.prefix,
        prefix: rotated.apiKey.prefix,
        serviceId: existing.serviceId
      }
    });

    res.json({
      apiKey: publicApiKey(rotated.apiKey),
      revokedApiKey: publicApiKey(rotated.revokedApiKey)
    });
  })
);
