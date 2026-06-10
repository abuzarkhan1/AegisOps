import { createSecret, sha256 } from "../../../shared/security/crypto";
import { platformRepository } from "../repositories/platform.repository";

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
}

export const apiKeyService = new ApiKeyService();

