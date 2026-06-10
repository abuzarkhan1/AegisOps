import crypto from "node:crypto";
import { db } from "../../../infrastructure/database/pool";

export type DeploymentProvider = "github" | "gitlab";

export type DeploymentRecord = {
  id: string;
  provider: DeploymentProvider;
  organizationId?: string;
  projectId?: string;
  serviceId?: string;
  serviceName: string;
  environment: string;
  version?: string;
  commitSha?: string;
  deployedBy?: string;
  repository?: string;
  timestamp: string;
  receivedAt: string;
  metadata?: Record<string, unknown>;
};

const toIso = (value: Date | string | null | undefined) => (value ? new Date(value).toISOString() : undefined);

const uuidOrNull = (value: unknown) =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;

const normalizeDeployment = (row: any): DeploymentRecord => {
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    provider: row.provider,
    organizationId: row.organizationId ?? undefined,
    projectId: row.projectId ?? undefined,
    serviceId: row.serviceId ?? undefined,
    serviceName: typeof metadata.serviceName === "string" ? metadata.serviceName : row.serviceId ?? "unknown-service",
    environment: row.environment,
    version: row.version ?? undefined,
    commitSha: row.commitSha ?? undefined,
    deployedBy: row.deployedBy ?? undefined,
    repository: row.repository ?? undefined,
    timestamp: toIso(row.timestamp) ?? new Date().toISOString(),
    receivedAt: toIso(row.receivedAt) ?? new Date().toISOString(),
    metadata
  };
};

export class DeploymentRepository {
  async create(provider: DeploymentProvider, payload: Partial<DeploymentRecord>) {
    const metadata = {
      ...(payload.metadata ?? {}),
      serviceName: payload.serviceName ?? "unknown-service"
    };
    const result = await db.query(
      `
      INSERT INTO deployments (
        id,
        organization_id,
        project_id,
        service_id,
        provider,
        environment,
        version,
        commit_sha,
        author,
        repository_url,
        metadata,
        deployed_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING
        id,
        provider,
        organization_id AS "organizationId",
        project_id AS "projectId",
        service_id AS "serviceId",
        environment,
        version,
        commit_sha AS "commitSha",
        author AS "deployedBy",
        repository_url AS "repository",
        metadata,
        deployed_at AS "timestamp",
        created_at AS "receivedAt"
      `,
      [
        crypto.randomUUID(),
        uuidOrNull(payload.organizationId),
        uuidOrNull(payload.projectId),
        uuidOrNull(payload.serviceId),
        provider,
        payload.environment ?? "development",
        payload.version ?? null,
        payload.commitSha ?? null,
        payload.deployedBy ?? null,
        payload.repository ?? null,
        JSON.stringify(metadata),
        payload.timestamp ?? new Date().toISOString()
      ]
    );
    return normalizeDeployment(result.rows[0]);
  }

  async list() {
    const result = await db.query(
      `
      SELECT
        id,
        provider,
        organization_id AS "organizationId",
        project_id AS "projectId",
        service_id AS "serviceId",
        environment,
        version,
        commit_sha AS "commitSha",
        author AS "deployedBy",
        repository_url AS "repository",
        metadata,
        deployed_at AS "timestamp",
        created_at AS "receivedAt"
      FROM deployments
      ORDER BY created_at DESC
      LIMIT 100
      `
    );
    return result.rows.map(normalizeDeployment);
  }

  async get(deploymentId: string) {
    const result = await db.query(
      `
      SELECT
        id,
        provider,
        organization_id AS "organizationId",
        project_id AS "projectId",
        service_id AS "serviceId",
        environment,
        version,
        commit_sha AS "commitSha",
        author AS "deployedBy",
        repository_url AS "repository",
        metadata,
        deployed_at AS "timestamp",
        created_at AS "receivedAt"
      FROM deployments
      WHERE id = $1
      `,
      [deploymentId]
    );
    return result.rows[0] ? normalizeDeployment(result.rows[0]) : undefined;
  }

  async saveImpact(deploymentId: string, impactData: Record<string, unknown>) {
    const deployment = await this.get(deploymentId);
    if (!deployment) return undefined;
    const metadata = {
      ...(deployment.metadata || {}),
      impact: {
        deploymentId,
        serviceName: deployment.serviceName,
        status: "complete",
        ...impactData
      }
    };
    await db.query(
      `
      UPDATE deployments
      SET metadata = $2
      WHERE id = $1
      `,
      [deploymentId, JSON.stringify(metadata)]
    );
    return metadata.impact;
  }

  async impact(deploymentId: string) {
    const deployment = await this.get(deploymentId);
    if (!deployment) return undefined;
    if (deployment.metadata && (deployment.metadata as any).impact) {
      return (deployment.metadata as any).impact;
    }
    return {
      deploymentId,
      serviceName: deployment.serviceName,
      summary: "Deployment impact analysis has not been generated yet.",
      status: "pending",
      compareWindow: {
        beforeMinutes: 30,
        afterMinutes: 30
      }
    };
  }
}

export const deploymentRepository = new DeploymentRepository();

