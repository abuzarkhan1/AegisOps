import { createSecret, sha256 } from "../../../shared/security/crypto";
import { platformRepository } from "../repositories/platform.repository";
import type { ApiKeyRecord } from "../types/platform.types";

export class ApiKeyService {
  async create(input: { organizationId: string; serviceId?: string; name: string }) {
    const rawKey = createSecret("aeg");
    const record = await platformRepository.createApiKey({
      organizationId: input.organizationId,
      serviceId: input.serviceId,
      name: input.name,
      prefix: rawKey.slice(0, 12),
      keyHash: sha256(rawKey)
    });
    return { ...record, rawKey };
  }

  async validate(rawKey: string) {
    return platformRepository.validateApiKey(sha256(rawKey));
  }

  async rotate(existing: ApiKeyRecord) {
    const rawKey = createSecret("aeg");
    const rotated = await platformRepository.rotateApiKey({
      existing,
      prefix: rawKey.slice(0, 12),
      keyHash: sha256(rawKey)
    });
    return rotated ? { ...rotated, apiKey: { ...rotated.apiKey, rawKey } } : undefined;
  }
}

export const apiKeyService = new ApiKeyService();
