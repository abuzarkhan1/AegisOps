import { Router } from "express";
import { asyncHandler } from "../../shared/http/asyncHandler";
import { notFound } from "../../shared/http/errors";
import { optionalString, requiredString } from "../../shared/http/requestValidation";
import { platformRepository } from "../platform/repositories/platform.repository";
import { apiKeyService } from "../platform/services/apiKey.service";

export const apiKeyRouter = Router();

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
    res.status(201).json({ apiKey });
  })
);

apiKeyRouter.get(
  "/services/:serviceId/api-keys",
  asyncHandler(async (req, res) => {
    const service = await platformRepository.getService(req.params.serviceId);
    if (!service) throw notFound("Service");
    res.json({ apiKeys: await platformRepository.listApiKeys(service.id) });
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
    res.status(201).json({ apiKey });
  })
);

apiKeyRouter.get(
  "/api-keys",
  asyncHandler(async (_req, res) => {
    res.json({ apiKeys: await platformRepository.listApiKeys() });
  })
);

apiKeyRouter.post(
  "/api-keys/validate",
  asyncHandler(async (req, res) => {
    const apiKey = await apiKeyService.validate(requiredString(req.body, "apiKey"));
    const service = apiKey?.serviceId ? await platformRepository.getService(apiKey.serviceId) : undefined;
    const project = service?.projectId ? await platformRepository.getProject(service.projectId) : undefined;
    res.json({
      valid: Boolean(apiKey),
      apiKey: apiKey
        ? {
            id: apiKey.id,
            organizationId: apiKey.organizationId,
            serviceId: apiKey.serviceId,
            serviceName: service?.name,
            projectId: service?.projectId,
            projectKey: project?.projectKey,
            prefix: apiKey.prefix,
            status: apiKey.status,
            lastUsedAt: apiKey.lastUsedAt
          }
        : undefined
    });
  })
);

apiKeyRouter.delete(
  "/api-keys/:apiKeyId",
  asyncHandler(async (req, res) => {
    const apiKey = await platformRepository.revokeApiKey(req.params.apiKeyId);
    if (!apiKey) throw notFound("API key");
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
