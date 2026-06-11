import { db } from "../../../infrastructure/database/pool";
import { newId, slugify } from "../../../shared/security/crypto";
import type {
  AlertOperator,
  AlertRule,
  ApiKeyRecord,
  AuditLog,
  AuthUser,
  Incident,
  IncidentSeverity,
  IncidentStatus,
  Organization,
  Project,
  ServiceRecord,
  ServiceType,
  User,
  UserRole
} from "../types/platform.types";

const toIso = (value: Date | string | null | undefined) => (value ? new Date(value).toISOString() : undefined);

const userFields = `
  id,
  email,
  name,
  role,
  status,
  password_hash AS "passwordHash",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

const organizationFields = `
  id,
  name,
  slug,
  plan,
  settings,
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

const projectFields = `
  id,
  organization_id AS "organizationId",
  project_key AS "projectKey",
  name,
  environment,
  project_type AS "projectType",
  repository_url AS "repositoryUrl",
  owner_team AS "ownerTeam",
  description,
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

const serviceFields = `
  id,
  organization_id AS "organizationId",
  project_id AS "projectId",
  name,
  slug,
  environment,
  service_type AS "serviceType",
  language,
  repository_url AS "repositoryUrl",
  health_status AS "healthStatus",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

const incidentFields = `
  id,
  organization_id AS "organizationId",
  project_id AS "projectId",
  service_id AS "serviceId",
  title,
  severity,
  status,
  assignee_id AS "assigneeId",
  summary,
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  resolved_at AS "resolvedAt"
`;

const alertRuleFields = `
  id,
  organization_id AS "organizationId",
  service_id AS "serviceId",
  name,
  metric,
  operator,
  threshold,
  duration_seconds AS "durationSeconds",
  severity,
  enabled,
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

const apiKeyFields = `
  id,
  organization_id AS "organizationId",
  service_id AS "serviceId",
  name,
  prefix,
  key_hash AS "keyHash",
  status,
  last_used_at AS "lastUsedAt",
  created_at AS "createdAt",
  revoked_at AS "revokedAt"
`;

const auditFields = `
  id,
  organization_id AS "organizationId",
  actor_id AS "actorId",
  action,
  resource_type AS "resourceType",
  resource_id AS "resourceId",
  metadata,
  created_at AS "createdAt"
`;

const normalizeUser = (row: any): AuthUser => ({
  ...row,
  status: row.status ?? "active",
  createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
  updatedAt: toIso(row.updatedAt) ?? toIso(row.createdAt) ?? new Date().toISOString()
});

const normalizeOrganization = (row: any): Organization => ({
  ...row,
  plan: row.plan ?? "free",
  createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
  updatedAt: toIso(row.updatedAt) ?? new Date().toISOString()
});

const normalizeProject = (row: any): Project => ({
  ...row,
  projectKey: row.projectKey ?? slugify(row.name ?? "project"),
  projectType: row.projectType ?? "monolith",
  repositoryUrl: row.repositoryUrl ?? undefined,
  ownerTeam: row.ownerTeam ?? undefined,
  description: row.description ?? undefined,
  createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
  updatedAt: toIso(row.updatedAt) ?? new Date().toISOString()
});

const normalizeService = (row: any): ServiceRecord => ({
  ...row,
  environment: row.environment ?? "production",
  serviceType: row.serviceType ?? "api",
  language: row.language ?? undefined,
  repositoryUrl: row.repositoryUrl ?? undefined,
  createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
  updatedAt: toIso(row.updatedAt) ?? new Date().toISOString()
});

const normalizeIncident = (row: any): Incident => ({
  ...row,
  projectId: row.projectId ?? undefined,
  serviceId: row.serviceId ?? undefined,
  assigneeId: row.assigneeId ?? undefined,
  summary: row.summary ?? undefined,
  resolvedAt: toIso(row.resolvedAt),
  createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
  updatedAt: toIso(row.updatedAt) ?? new Date().toISOString()
});

const normalizeAlertRule = (row: any): AlertRule => ({
  ...row,
  serviceId: row.serviceId ?? undefined,
  threshold: Number(row.threshold),
  createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
  updatedAt: toIso(row.updatedAt) ?? new Date().toISOString()
});

const normalizeApiKey = (row: any): ApiKeyRecord => ({
  ...row,
  serviceId: row.serviceId ?? undefined,
  status: row.status ?? (row.revokedAt ? "revoked" : "active"),
  lastUsedAt: toIso(row.lastUsedAt),
  revokedAt: toIso(row.revokedAt),
  createdAt: toIso(row.createdAt) ?? new Date().toISOString()
});

const normalizeAuditLog = (row: any): AuditLog => ({
  ...row,
  organizationId: row.organizationId ?? undefined,
  actorId: row.actorId ?? undefined,
  resourceId: row.resourceId ?? undefined,
  createdAt: toIso(row.createdAt) ?? new Date().toISOString()
});

const publicUser = (user: AuthUser): User => {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
};

const boundedLimit = (value: number | undefined, fallback = 100, max = 1000) => {
  if (!value || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(Math.trunc(value), max));
};

export class PlatformRepository {
  async createUser(input: { email: string; name: string; passwordHash: string; role?: UserRole }) {
    const result = await db.query(
      `
      INSERT INTO users (id, email, name, password_hash, role, status)
      VALUES ($1, lower($2), $3, $4, $5, 'active')
      RETURNING ${userFields}
      `,
      [newId(), input.email, input.name, input.passwordHash, input.role ?? "owner"]
    );
    return normalizeUser(result.rows[0]);
  }

  async findUserByEmail(email: string) {
    const result = await db.query(`SELECT ${userFields} FROM users WHERE email = lower($1)`, [email]);
    return result.rows[0] ? normalizeUser(result.rows[0]) : undefined;
  }

  async findUserById(userId: string) {
    const result = await db.query(`SELECT ${userFields} FROM users WHERE id = $1`, [userId]);
    return result.rows[0] ? normalizeUser(result.rows[0]) : undefined;
  }

  async listUsers() {
    const result = await db.query(`SELECT ${userFields} FROM users ORDER BY created_at DESC`);
    return result.rows.map(normalizeUser).map(publicUser);
  }

  async listOrganizationMembers(organizationId: string) {
    const result = await db.query(
      `
      SELECT u.id,
             u.email,
             u.name,
             u.role,
             u.created_at AS "createdAt",
             om.role AS "memberRole",
             om.invited_at AS "invitedAt"
      FROM organization_members om
      JOIN users u ON u.id = om.user_id
      WHERE om.organization_id = $1
      ORDER BY om.invited_at DESC
      `,
      [organizationId]
    );
    return result.rows.map((row) => ({
      ...row,
      createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
      invitedAt: toIso(row.invitedAt) ?? new Date().toISOString()
    }));
  }

  async createOrganization(input: {
    name: string;
    plan?: Organization["plan"];
    settings?: Record<string, unknown>;
    ownerId?: string;
  }) {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const organizationResult = await client.query(
        `
        INSERT INTO organizations (id, name, slug, plan, settings)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING ${organizationFields}
        `,
        [newId(), input.name, slugify(input.name), input.plan ?? "free", JSON.stringify(input.settings ?? {})]
      );
      const organization = normalizeOrganization(organizationResult.rows[0]);
      if (input.ownerId) {
        await client.query(
          `
          INSERT INTO organization_members (organization_id, user_id, role)
          VALUES ($1, $2, 'owner')
          ON CONFLICT (organization_id, user_id) DO UPDATE SET role = excluded.role
          `,
          [organization.id, input.ownerId]
        );
      }
      await client.query("COMMIT");
      await this.audit({
        organizationId: organization.id,
        actorId: input.ownerId,
        action: "organization.created",
        resourceType: "organization",
        resourceId: organization.id
      });
      return organization;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listOrganizations() {
    const result = await db.query(`SELECT ${organizationFields} FROM organizations ORDER BY created_at DESC`);
    return result.rows.map(normalizeOrganization);
  }

  async getOrganization(orgId: string) {
    const result = await db.query(`SELECT ${organizationFields} FROM organizations WHERE id = $1`, [orgId]);
    return result.rows[0] ? normalizeOrganization(result.rows[0]) : undefined;
  }

  async updateOrganization(
    orgId: string,
    patch: { name?: string; plan?: Organization["plan"]; settings?: Record<string, unknown> }
  ) {
    const existing = await this.getOrganization(orgId);
    if (!existing) return undefined;
    const result = await db.query(
      `
      UPDATE organizations
      SET name = $2,
          slug = $3,
          plan = $4,
          settings = $5,
          updated_at = now()
      WHERE id = $1
      RETURNING ${organizationFields}
      `,
      [
        orgId,
        patch.name ?? existing.name,
        patch.name ? slugify(patch.name) : existing.slug,
        patch.plan ?? existing.plan,
        JSON.stringify(patch.settings ?? existing.settings)
      ]
    );
    return normalizeOrganization(result.rows[0]);
  }

  async addOrganizationMember(input: { organizationId: string; userId: string; role: UserRole }) {
    await db.query(
      `
      INSERT INTO organization_members (organization_id, user_id, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (organization_id, user_id) DO UPDATE SET role = excluded.role
      `,
      [input.organizationId, input.userId, input.role]
    );
  }

  async updateOrganizationMemberRole(input: { organizationId: string; userId: string; role: UserRole }) {
    const result = await db.query(
      `
      UPDATE organization_members
      SET role = $3
      WHERE organization_id = $1 AND user_id = $2
      RETURNING organization_id
      `,
      [input.organizationId, input.userId, input.role]
    );
    return Boolean(result.rowCount);
  }

  async removeOrganizationMember(input: { organizationId: string; userId: string }) {
    const result = await db.query("DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2", [
      input.organizationId,
      input.userId
    ]);
    return Boolean(result.rowCount);
  }

  async checkOrganizationMember(organizationId: string, userId: string): Promise<boolean> {
    const result = await db.query(
      "SELECT 1 FROM organization_members WHERE organization_id = $1 AND user_id = $2",
      [organizationId, userId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async createProject(input: {
    organizationId: string;
    name: string;
    projectKey?: string;
    environment?: string;
    projectType?: Project["projectType"];
    repositoryUrl?: string;
    ownerTeam?: string;
    description?: string;
  }) {
    const result = await db.query(
      `
      INSERT INTO projects (id, organization_id, project_key, name, environment, project_type, repository_url, owner_team, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING ${projectFields}
      `,
      [
        newId(),
        input.organizationId,
        slugify(input.projectKey ?? input.name),
        input.name,
        input.environment ?? "dev",
        input.projectType ?? "monolith",
        input.repositoryUrl ?? null,
        input.ownerTeam ?? null,
        input.description ?? null
      ]
    );
    return normalizeProject(result.rows[0]);
  }

  async listProjects(environment?: string, organizationId?: string) {
    const result = await db.query(
      `
      SELECT ${projectFields}
      FROM projects
      WHERE ($1::text IS NULL OR environment = $1)
        AND ($2::uuid IS NULL OR organization_id = $2)
      ORDER BY created_at DESC
      `,
      [environment ?? null, organizationId ?? null]
    );
    return result.rows.map(normalizeProject);
  }

  async getProject(projectId: string) {
    const result = await db.query(`SELECT ${projectFields} FROM projects WHERE id = $1`, [projectId]);
    return result.rows[0] ? normalizeProject(result.rows[0]) : undefined;
  }

  async getProjectByKey(projectKey: string, organizationId?: string) {
    const result = await db.query(
      `
      SELECT ${projectFields}
      FROM projects
      WHERE project_key = $1
        AND ($2::uuid IS NULL OR organization_id = $2)
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [projectKey, organizationId ?? null]
    );
    return result.rows[0] ? normalizeProject(result.rows[0]) : undefined;
  }

  async updateProject(
    projectId: string,
    patch: {
      name?: string;
      projectKey?: string;
      environment?: string;
      projectType?: Project["projectType"];
      repositoryUrl?: string;
      ownerTeam?: string;
      description?: string;
    }
  ) {
    const existing = await this.getProject(projectId);
    if (!existing) return undefined;
    const result = await db.query(
      `
      UPDATE projects
      SET project_key = $2,
          name = $3,
          environment = $4,
          project_type = $5,
          repository_url = $6,
          owner_team = $7,
          description = $8,
          updated_at = now()
      WHERE id = $1
      RETURNING ${projectFields}
      `,
      [
        projectId,
        patch.projectKey ? slugify(patch.projectKey) : existing.projectKey,
        patch.name ?? existing.name,
        patch.environment ?? existing.environment,
        patch.projectType ?? existing.projectType,
        patch.repositoryUrl ?? existing.repositoryUrl ?? null,
        patch.ownerTeam ?? existing.ownerTeam ?? null,
        patch.description ?? existing.description ?? null
      ]
    );
    return normalizeProject(result.rows[0]);
  }

  async deleteProject(projectId: string) {
    const result = await db.query("DELETE FROM projects WHERE id = $1", [projectId]);
    return Boolean(result.rowCount);
  }

  async createService(input: {
    organizationId: string;
    projectId: string;
    name: string;
    environment?: string;
    serviceType?: ServiceType;
    language?: string;
    repositoryUrl?: string;
  }) {
    const result = await db.query(
      `
      INSERT INTO services (id, organization_id, project_id, name, slug, environment, service_type, language, repository_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING ${serviceFields}
      `,
      [
        newId(),
        input.organizationId,
        input.projectId,
        input.name,
        slugify(input.name),
        input.environment ?? "production",
        input.serviceType ?? "api",
        input.language ?? null,
        input.repositoryUrl ?? null
      ]
    );
    return normalizeService(result.rows[0]);
  }

  async listServices(projectId?: string, organizationId?: string) {
    const result = await db.query(
      `
      SELECT ${serviceFields}
      FROM services
      WHERE ($1::uuid IS NULL OR project_id = $1)
        AND ($2::uuid IS NULL OR organization_id = $2)
      ORDER BY created_at DESC
      `,
      [projectId ?? null, organizationId ?? null]
    );
    return result.rows.map(normalizeService);
  }

  async getService(serviceId: string) {
    const result = await db.query(`SELECT ${serviceFields} FROM services WHERE id = $1`, [serviceId]);
    return result.rows[0] ? normalizeService(result.rows[0]) : undefined;
  }

  async getServiceByName(projectId: string, name: string) {
    const result = await db.query(
      `SELECT ${serviceFields} FROM services WHERE project_id = $1 AND name = $2`,
      [projectId, name]
    );
    return result.rows[0] ? normalizeService(result.rows[0]) : undefined;
  }

  async updateService(
    serviceId: string,
    patch: Partial<Pick<ServiceRecord, "name" | "environment" | "serviceType" | "language" | "repositoryUrl" | "healthStatus">>
  ) {
    const existing = await this.getService(serviceId);
    if (!existing) return undefined;
    const result = await db.query(
      `
      UPDATE services
      SET name = $2,
          slug = $3,
          environment = $4,
          service_type = $5,
          language = $6,
          repository_url = $7,
          health_status = $8,
          updated_at = now()
      WHERE id = $1
      RETURNING ${serviceFields}
      `,
      [
        serviceId,
        patch.name ?? existing.name,
        patch.name ? slugify(patch.name) : existing.slug,
        patch.environment ?? existing.environment,
        patch.serviceType ?? existing.serviceType,
        patch.language ?? existing.language ?? null,
        patch.repositoryUrl ?? existing.repositoryUrl ?? null,
        patch.healthStatus ?? existing.healthStatus
      ]
    );
    return normalizeService(result.rows[0]);
  }

  async deleteService(serviceId: string) {
    const result = await db.query("DELETE FROM services WHERE id = $1", [serviceId]);
    return Boolean(result.rowCount);
  }

  async getServiceConnectionStatus(serviceId: string, organizationId?: string) {
    const result = await db.query(
      `
      WITH recent AS (
        SELECT now() - interval '15 minutes' AS cutoff
      ),
      log_stats AS (
        SELECT
          max(timestamp) AS "lastLogAt",
          max(timestamp) FILTER (WHERE COALESCE(metadata->>'eventType', '') <> 'test-event') AS "lastRealLogAt",
          count(*) FILTER (WHERE COALESCE(metadata->>'eventType', '') = 'test-event')::int AS "testLogs",
          count(*) FILTER (
            WHERE timestamp >= (SELECT cutoff FROM recent)
              AND COALESCE(metadata->>'eventType', '') <> 'test-event'
          )::int AS "logsLast15m",
          count(*) FILTER (
            WHERE timestamp >= (SELECT cutoff FROM recent)
              AND COALESCE(metadata->>'eventType', '') <> 'test-event'
              AND COALESCE(status_code, 0) >= 400
          )::int AS "errorLogsLast15m",
          count(*) FILTER (
            WHERE timestamp >= (SELECT cutoff FROM recent)
              AND COALESCE(metadata->>'eventType', '') <> 'test-event'
              AND status_code IS NOT NULL
          )::int AS "requestLogsLast15m",
          count(*) FILTER (WHERE COALESCE(metadata->>'eventType', '') <> 'test-event')::int AS "realLogs"
        FROM logs
        WHERE service_id = $1
          AND ($2::uuid IS NULL OR organization_id = $2)
      ),
      metric_stats AS (
        SELECT
          max(timestamp) AS "lastMetricAt",
          max(timestamp) FILTER (WHERE COALESCE(labels->>'source', '') <> 'connect-project') AS "lastRealMetricAt",
          count(*) FILTER (WHERE COALESCE(labels->>'source', '') = 'connect-project')::int AS "testMetrics",
          count(*) FILTER (
            WHERE timestamp >= (SELECT cutoff FROM recent)
              AND COALESCE(labels->>'source', '') <> 'connect-project'
          )::int AS "metricsLast15m",
          count(*) FILTER (WHERE COALESCE(labels->>'source', '') <> 'connect-project')::int AS "realMetrics",
          COALESCE(sum(value) FILTER (
            WHERE timestamp >= (SELECT cutoff FROM recent)
              AND metric_name = 'http_requests_total'
              AND COALESCE(labels->>'source', '') <> 'connect-project'
          ), 0)::float AS "requestMetricSum",
          COALESCE(sum(value) FILTER (
            WHERE timestamp >= (SELECT cutoff FROM recent)
              AND metric_name = 'http_errors_total'
              AND COALESCE(labels->>'source', '') <> 'connect-project'
          ), 0)::float AS "errorMetricSum",
          COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY value) FILTER (
            WHERE timestamp >= (SELECT cutoff FROM recent)
              AND metric_name = 'http_request_duration_ms'
              AND COALESCE(labels->>'source', '') <> 'connect-project'
          ), 0)::float AS "p95LatencyLast15m"
        FROM metrics
        WHERE service_id = $1
          AND ($2::uuid IS NULL OR organization_id = $2)
      ),
      alert_stats AS (
        SELECT count(*) FILTER (WHERE enabled)::int AS "activeAlerts"
        FROM alert_rules
        WHERE service_id = $1
          AND ($2::uuid IS NULL OR organization_id = $2)
      )
      SELECT *
      FROM log_stats, metric_stats, alert_stats
      `,
      [serviceId, organizationId ?? null]
    );
    const row = result.rows[0] ?? {};
    const lastLogAt = toIso(row.lastLogAt);
    const lastMetricAt = toIso(row.lastMetricAt);
    const lastRealLogAt = toIso(row.lastRealLogAt);
    const lastRealMetricAt = toIso(row.lastRealMetricAt);
    const lastHeartbeatAt = [lastLogAt, lastMetricAt].filter(Boolean).sort().at(-1);
    const lastRealHeartbeatAt = [lastRealLogAt, lastRealMetricAt].filter(Boolean).sort().at(-1);
    const logsLast15m = Number(row.logsLast15m ?? 0);
    const metricsLast15m = Number(row.metricsLast15m ?? 0);
    const realTelemetryEver = Number(row.realLogs ?? 0) + Number(row.realMetrics ?? 0) > 0;
    const testTelemetryEver = Number(row.testLogs ?? 0) + Number(row.testMetrics ?? 0) > 0;
    const requestMetricSum = Number(row.requestMetricSum ?? 0);
    const errorMetricSum = Number(row.errorMetricSum ?? 0);
    const requestLogsLast15m = Number(row.requestLogsLast15m ?? 0);
    const errorLogsLast15m = Number(row.errorLogsLast15m ?? 0);
    const requestsForErrorRate = requestMetricSum > 0 ? requestMetricSum : requestLogsLast15m;
    const errorsForErrorRate = requestMetricSum > 0 ? errorMetricSum : errorLogsLast15m;
    const errorRateLast15m = requestsForErrorRate > 0 ? Number(((errorsForErrorRate / requestsForErrorRate) * 100).toFixed(2)) : 0;
    const p95LatencyLast15m = row.p95LatencyLast15m === null || row.p95LatencyLast15m === undefined ? 0 : Number(row.p95LatencyLast15m);
    const hasRecentTelemetry = logsLast15m + metricsLast15m > 0;
    const isStale = realTelemetryEver && (!lastRealHeartbeatAt || new Date(lastRealHeartbeatAt).getTime() < Date.now() - 15 * 60 * 1000);
    const highErrorRate = requestsForErrorRate >= 20 && errorRateLast15m >= 5;
    const status = !realTelemetryEver
      ? testTelemetryEver
        ? "waiting_for_telemetry"
        : "not_connected"
      : highErrorRate
        ? "erroring"
        : isStale || !hasRecentTelemetry
          ? "stale"
          : "connected";
    const connected = status === "connected" || status === "erroring";

    return {
      serviceId,
      connected,
      status,
      lastLogAt,
      lastMetricAt,
      lastHeartbeatAt,
      logsLast15m,
      metricsLast15m,
      errorRateLast15m,
      p95LatencyLast15m,
      telemetryHealth: {
        logs: logsLast15m > 0 ? "receiving" : realTelemetryEver ? "stale" : "waiting",
        metrics: metricsLast15m > 0 ? "receiving" : realTelemetryEver ? "stale" : "waiting",
        alerts: Number(row.activeAlerts ?? 0) > 0 ? "active" : "inactive"
      }
    };
  }

  async createServiceTestTelemetry(input: { project: Project; service: ServiceRecord }) {
    const timestamp = new Date();
    const requestId = `test-${newId()}`;
    const route = "/aegisops/test-connection";
    const method = "POST";
    const statusCode = 200;
    const durationMs = 18.4;
    const environment = input.service.environment ?? input.project.environment ?? "dev";
    const metadata = {
      source: "connect-project",
      eventType: "test-event",
      serviceType: input.service.serviceType,
      language: input.service.language
    };
    const labels = {
      source: "connect-project",
      route,
      method,
      statusCode: String(statusCode),
      serviceType: input.service.serviceType
    };
    const logId = newId();
    const requestMetricId = newId();
    const durationMetricId = newId();

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `
        INSERT INTO logs (
          id,
          organization_id,
          project_id,
          service_id,
          project_key,
          service_name,
          level,
          message,
          trace_id,
          request_id,
          route,
          method,
          status_code,
          duration_ms,
          environment,
          metadata,
          timestamp
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'info', $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        `,
        [
          logId,
          input.project.organizationId,
          input.project.id,
          input.service.id,
          input.project.projectKey,
          input.service.name,
          `AegisOps test event received for ${input.service.name}`,
          requestId,
          requestId,
          route,
          method,
          statusCode,
          durationMs,
          environment,
          JSON.stringify(metadata),
          timestamp
        ]
      );

      await client.query(
        `
        INSERT INTO metrics (
          id,
          organization_id,
          project_id,
          service_id,
          project_key,
          service_name,
          environment,
          metric_name,
          value,
          labels,
          timestamp
        )
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, 'http_requests_total', 1, $8, $9),
          ($10, $2, $3, $4, $5, $6, $7, 'http_request_duration_ms', $11, $8, $9)
        `,
        [
          requestMetricId,
          input.project.organizationId,
          input.project.id,
          input.service.id,
          input.project.projectKey,
          input.service.name,
          environment,
          JSON.stringify(labels),
          timestamp,
          durationMetricId,
          durationMs
        ]
      );

      await client.query(
        "UPDATE services SET health_status = 'healthy', updated_at = now() WHERE id = $1",
        [input.service.id]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return {
      logId,
      metricIds: [requestMetricId, durationMetricId],
      timestamp: timestamp.toISOString()
    };
  }

  async createApiKey(input: { organizationId: string; serviceId?: string; name: string; prefix: string; keyHash: string }) {
    const result = await db.query(
      `
      INSERT INTO api_keys (id, organization_id, service_id, name, prefix, key_hash)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING ${apiKeyFields}
      `,
      [newId(), input.organizationId, input.serviceId ?? null, input.name, input.prefix, input.keyHash]
    );
    return normalizeApiKey(result.rows[0]);
  }

  async listApiKeys(serviceId?: string, organizationId?: string) {
    const result = await db.query(
      `
      SELECT ${apiKeyFields}
      FROM api_keys
      WHERE ($1::uuid IS NULL OR service_id = $1)
        AND ($2::uuid IS NULL OR organization_id = $2)
      ORDER BY created_at DESC
      `,
      [serviceId ?? null, organizationId ?? null]
    );
    return result.rows.map(normalizeApiKey).map(({ keyHash: _keyHash, ...apiKey }) => apiKey);
  }

  async revokeApiKey(apiKeyId: string) {
    const result = await db.query(
      `
      UPDATE api_keys
      SET status = 'revoked',
          revoked_at = COALESCE(revoked_at, now())
      WHERE id = $1
      RETURNING ${apiKeyFields}
      `,
      [apiKeyId]
    );
    return result.rows[0] ? normalizeApiKey(result.rows[0]) : undefined;
  }

  async validateApiKey(keyHash: string) {
    const result = await db.query(
      `
      UPDATE api_keys
      SET last_used_at = now()
      WHERE key_hash = $1
        AND status = 'active'
        AND revoked_at IS NULL
      RETURNING ${apiKeyFields}
      `,
      [keyHash]
    );
    return result.rows[0] ? normalizeApiKey(result.rows[0]) : undefined;
  }

  async createRefreshToken(input: { userId: string; tokenHash: string; expiresAt: Date }) {
    const result = await db.query(
      `
      INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
      VALUES ($1, $2, $3, $4)
      RETURNING id,
                user_id AS "userId",
                token_hash AS "tokenHash",
                expires_at AS "expiresAt",
                revoked_at AS "revokedAt",
                created_at AS "createdAt"
      `,
      [newId(), input.userId, input.tokenHash, input.expiresAt]
    );
    return {
      ...result.rows[0],
      expiresAt: toIso(result.rows[0].expiresAt),
      revokedAt: toIso(result.rows[0].revokedAt),
      createdAt: toIso(result.rows[0].createdAt)
    };
  }

  async findActiveRefreshToken(tokenHash: string) {
    const result = await db.query(
      `
      SELECT id,
             user_id AS "userId",
             token_hash AS "tokenHash",
             expires_at AS "expiresAt",
             revoked_at AS "revokedAt",
             created_at AS "createdAt"
      FROM refresh_tokens
      WHERE token_hash = $1
        AND revoked_at IS NULL
        AND expires_at > now()
      `,
      [tokenHash]
    );
    return result.rows[0]
      ? {
          ...result.rows[0],
          expiresAt: toIso(result.rows[0].expiresAt),
          revokedAt: toIso(result.rows[0].revokedAt),
          createdAt: toIso(result.rows[0].createdAt)
        }
      : undefined;
  }

  async revokeRefreshToken(tokenHash: string) {
    const result = await db.query(
      `
      UPDATE refresh_tokens
      SET revoked_at = COALESCE(revoked_at, now())
      WHERE token_hash = $1
      RETURNING id
      `,
      [tokenHash]
    );
    return Boolean(result.rowCount);
  }

  async revokeUserRefreshTokens(userId: string) {
    await db.query(
      `
      UPDATE refresh_tokens
      SET revoked_at = COALESCE(revoked_at, now())
      WHERE user_id = $1
        AND revoked_at IS NULL
      `,
      [userId]
    );
  }

  async createIncident(input: {
    organizationId: string;
    projectId?: string;
    serviceId?: string;
    title: string;
    severity: IncidentSeverity;
    summary?: string;
  }) {
    const result = await db.query(
      `
      INSERT INTO incidents (id, organization_id, project_id, service_id, title, severity, summary)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING ${incidentFields}
      `,
      [newId(), input.organizationId, input.projectId ?? null, input.serviceId ?? null, input.title, input.severity, input.summary ?? null]
    );
    const incident = normalizeIncident(result.rows[0]);
    await this.createIncidentTimelineEvent({
      incidentId: incident.id,
      eventType: "created",
      message: `Incident created: ${incident.title}`,
      metadata: { severity: incident.severity }
    });
    return incident;
  }

  async listIncidents(filters?: {
    organizationId?: string;
    projectId?: string;
    serviceId?: string;
    status?: IncidentStatus;
  }) {
    const result = await db.query(
      `
      SELECT ${incidentFields}
      FROM incidents
      WHERE ($1::uuid IS NULL OR organization_id = $1)
        AND ($2::uuid IS NULL OR project_id = $2)
        AND ($3::uuid IS NULL OR service_id = $3)
        AND ($4::text IS NULL OR status = $4)
      ORDER BY created_at DESC
      `,
      [filters?.organizationId ?? null, filters?.projectId ?? null, filters?.serviceId ?? null, filters?.status ?? null]
    );
    return result.rows.map(normalizeIncident);
  }

  async getIncident(incidentId: string) {
    const result = await db.query(`SELECT ${incidentFields} FROM incidents WHERE id = $1`, [incidentId]);
    return result.rows[0] ? normalizeIncident(result.rows[0]) : undefined;
  }

  async findOpenIncidentByTitle(input: { organizationId: string; serviceId?: string; title: string }) {
    const result = await db.query(
      `
      SELECT ${incidentFields}
      FROM incidents
      WHERE organization_id = $1
        AND title = $2
        AND status <> 'resolved'
        AND ($3::uuid IS NULL OR service_id = $3)
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [input.organizationId, input.title, input.serviceId ?? null]
    );
    return result.rows[0] ? normalizeIncident(result.rows[0]) : undefined;
  }

  async updateIncident(
    incidentId: string,
    patch: Partial<Pick<Incident, "title" | "severity" | "status" | "assigneeId" | "summary">>
  ) {
    const existing = await this.getIncident(incidentId);
    if (!existing) return undefined;
    const result = await db.query(
      `
      UPDATE incidents
      SET title = $2,
          severity = $3,
          status = $4,
          assignee_id = $5,
          summary = $6,
          resolved_at = CASE WHEN $4 = 'resolved' THEN COALESCE(resolved_at, now()) ELSE resolved_at END,
          updated_at = now()
      WHERE id = $1
      RETURNING ${incidentFields}
      `,
      [
        incidentId,
        patch.title ?? existing.title,
        patch.severity ?? existing.severity,
        patch.status ?? existing.status,
        patch.assigneeId ?? existing.assigneeId ?? null,
        patch.summary ?? existing.summary ?? null
      ]
    );
    const incident = normalizeIncident(result.rows[0]);
    await this.createIncidentTimelineEvent({
      incidentId,
      eventType: "updated",
      message: `Incident updated: ${incident.status}`,
      metadata: patch
    });
    return incident;
  }

  async createIncidentTimelineEvent(input: { incidentId: string; eventType: string; message: string; metadata?: Record<string, unknown> }) {
    const result = await db.query(
      `
      INSERT INTO incident_timeline_events (id, incident_id, event_type, message, metadata)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, incident_id AS "incidentId", event_type AS "eventType", message, metadata, created_at AS "createdAt"
      `,
      [newId(), input.incidentId, input.eventType, input.message, JSON.stringify(input.metadata ?? {})]
    );
    return {
      ...result.rows[0],
      createdAt: toIso(result.rows[0].createdAt)
    };
  }

  async listIncidentTimeline(incidentId: string) {
    const result = await db.query(
      `
      SELECT id, incident_id AS "incidentId", event_type AS "eventType", message, metadata, created_at AS "createdAt"
      FROM incident_timeline_events
      WHERE incident_id = $1
      ORDER BY created_at ASC
      `,
      [incidentId]
    );
    return result.rows.map((row) => ({ ...row, createdAt: toIso(row.createdAt) }));
  }

  async listAiAnalysis(incidentId: string) {
    const result = await db.query(
      `
      SELECT id,
             incident_id AS "incidentId",
             summary,
             likely_root_cause AS "likelyRootCause",
             COALESCE(confidence_score, confidence) AS "confidenceScore",
             COALESCE(confidence_score, confidence) AS confidence,
             evidence,
             recommended_actions AS "recommendedActions",
             rollback_recommendation AS "rollbackRecommendation",
             postmortem_draft AS "postmortemDraft",
             created_at AS "createdAt"
      FROM ai_analysis_results
      WHERE incident_id = $1
      ORDER BY created_at DESC
      `,
      [incidentId]
    );
    return result.rows.map((row) => ({ ...row, createdAt: toIso(row.createdAt) }));
  }

  async createAlertRule(input: {
    organizationId: string;
    serviceId?: string;
    name: string;
    metric: string;
    operator: AlertOperator;
    threshold: number;
    durationSeconds: number;
    severity: IncidentSeverity;
    enabled?: boolean;
  }) {
    const result = await db.query(
      `
      INSERT INTO alert_rules (id, organization_id, service_id, name, metric, operator, threshold, duration_seconds, severity, enabled)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING ${alertRuleFields}
      `,
      [
        newId(),
        input.organizationId,
        input.serviceId ?? null,
        input.name,
        input.metric,
        input.operator,
        input.threshold,
        input.durationSeconds,
        input.severity,
        input.enabled ?? true
      ]
    );
    return normalizeAlertRule(result.rows[0]);
  }

  async listAlertRules(filters?: { organizationId?: string; serviceId?: string; enabled?: boolean }) {
    const result = await db.query(
      `
      SELECT ${alertRuleFields}
      FROM alert_rules
      WHERE ($1::uuid IS NULL OR organization_id = $1)
        AND ($2::uuid IS NULL OR service_id = $2)
        AND ($3::boolean IS NULL OR enabled = $3)
      ORDER BY created_at DESC
      `,
      [filters?.organizationId ?? null, filters?.serviceId ?? null, filters?.enabled ?? null]
    );
    return result.rows.map(normalizeAlertRule);
  }

  async updateAlertRule(ruleId: string, patch: Partial<Omit<AlertRule, "id" | "createdAt">>) {
    const existingResult = await db.query(`SELECT ${alertRuleFields} FROM alert_rules WHERE id = $1`, [ruleId]);
    if (!existingResult.rows[0]) return undefined;
    const existing = normalizeAlertRule(existingResult.rows[0]);
    const result = await db.query(
      `
      UPDATE alert_rules
      SET name = $2,
          service_id = $3,
          metric = $4,
          operator = $5,
          threshold = $6,
          duration_seconds = $7,
          severity = $8,
          enabled = $9,
          updated_at = now()
      WHERE id = $1
      RETURNING ${alertRuleFields}
      `,
      [
        ruleId,
        patch.name ?? existing.name,
        patch.serviceId ?? existing.serviceId ?? null,
        patch.metric ?? existing.metric,
        patch.operator ?? existing.operator,
        patch.threshold ?? existing.threshold,
        patch.durationSeconds ?? existing.durationSeconds,
        patch.severity ?? existing.severity,
        patch.enabled ?? existing.enabled
      ]
    );
    return normalizeAlertRule(result.rows[0]);
  }

  async deleteAlertRule(ruleId: string) {
    const result = await db.query("DELETE FROM alert_rules WHERE id = $1", [ruleId]);
    return Boolean(result.rowCount);
  }

  async listAuditLogs(organizationId?: string) {
    const result = await db.query(
      `
      SELECT ${auditFields}
      FROM audit_logs
      WHERE ($1::uuid IS NULL OR organization_id = $1)
      ORDER BY created_at DESC
      LIMIT 200
      `,
      [organizationId ?? null]
    );
    return result.rows.map(normalizeAuditLog);
  }

  async audit(input: {
    organizationId?: string;
    actorId?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
  }) {
    const result = await db.query(
      `
      INSERT INTO audit_logs (id, organization_id, actor_id, action, resource_type, resource_id, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING ${auditFields}
      `,
      [
        newId(),
        input.organizationId ?? null,
        input.actorId ?? null,
        input.action,
        input.resourceType,
        input.resourceId ?? null,
        JSON.stringify(input.metadata ?? {})
      ]
    );
    return normalizeAuditLog(result.rows[0]);
  }

  async dashboardSummary(organizationId?: string) {
    const result = await db.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE status <> 'resolved')::int AS "openIncidents",
        COUNT(*) FILTER (WHERE severity = 'critical')::int AS "criticalIncidents",
        (SELECT COUNT(*)::int FROM projects WHERE ($1::uuid IS NULL OR organization_id = $1)) AS "projectsMonitored",
        (SELECT COUNT(*)::int FROM services WHERE ($1::uuid IS NULL OR organization_id = $1)) AS "servicesMonitored",
        (SELECT COUNT(*)::int FROM services WHERE health_status = 'healthy' AND ($1::uuid IS NULL OR organization_id = $1)) AS "healthyServices",
        (SELECT COUNT(*)::int FROM services WHERE health_status = 'degraded' AND ($1::uuid IS NULL OR organization_id = $1)) AS "degradedServices",
        (SELECT COUNT(*)::int FROM services WHERE health_status = 'down' AND ($1::uuid IS NULL OR organization_id = $1)) AS "downServices",
        (SELECT COUNT(*)::int FROM alert_rules WHERE enabled = true AND ($1::uuid IS NULL OR organization_id = $1)) AS "alertRulesEnabled",
        (SELECT COUNT(*)::int FROM logs WHERE ($1::uuid IS NULL OR organization_id = $1)) AS "logsIngested",
        (SELECT COUNT(*)::int FROM metrics WHERE ($1::uuid IS NULL OR organization_id = $1)) AS "metricsIngested",
        (
          SELECT COALESCE(SUM(value), 0)::float
          FROM metrics
          WHERE ($1::uuid IS NULL OR organization_id = $1)
            AND metric_name IN ('http_requests_total', 'request_count', 'requestCount', 'worker_jobs_processed_total', 'service_events_total')
            AND timestamp >= now() - interval '1 hour'
        ) AS "totalThroughput",
        (
          SELECT COALESCE(SUM(value) / 3600.0, 0)::float
          FROM metrics
          WHERE ($1::uuid IS NULL OR organization_id = $1)
            AND metric_name IN ('http_requests_total', 'request_count', 'requestCount', 'worker_jobs_processed_total', 'service_events_total')
            AND timestamp >= now() - interval '1 hour'
        ) AS "requestsPerSecond",
        (
          SELECT COALESCE(
            (SUM(value) FILTER (WHERE metric_name IN ('http_errors_total', 'http_5xx_total', 'error_count', 'errorCount', 'exceptions_total')) * 100.0)
              / NULLIF(SUM(value) FILTER (WHERE metric_name IN ('http_requests_total', 'request_count', 'requestCount')), 0),
            0
          )::float
          FROM metrics
          WHERE ($1::uuid IS NULL OR organization_id = $1)
            AND timestamp >= now() - interval '1 hour'
        ) AS "errorRate",
        (
          SELECT COALESCE(MAX(value), 0)::float
          FROM metrics
          WHERE ($1::uuid IS NULL OR organization_id = $1)
            AND metric_name IN ('http_request_duration_p95', 'p95_latency', 'p95LatencyMs', 'http_request_duration_ms')
            AND timestamp >= now() - interval '1 hour'
        ) AS "p95LatencyMs",
        (
          SELECT COALESCE(
            (COUNT(*) FILTER (WHERE health_status = 'healthy') * 100.0) / NULLIF(COUNT(*), 0),
            0
          )::float
          FROM services
          WHERE ($1::uuid IS NULL OR organization_id = $1)
        ) AS "uptimePercent"
      FROM incidents
      WHERE ($1::uuid IS NULL OR organization_id = $1)
      `,
      [organizationId ?? null]
    );
    return result.rows[0];
  }

  async dashboardErrorTrends(hours = 24, organizationId?: string) {
    const result = await db.query(
      `
      SELECT date_trunc('hour', created_at) AS bucket,
             COUNT(*)::int AS incidents,
             COUNT(*) FILTER (WHERE severity = 'critical')::int AS critical,
             COUNT(*) FILTER (WHERE severity = 'high')::int AS high,
             COUNT(*) FILTER (WHERE status <> 'resolved')::int AS open
      FROM incidents
      WHERE created_at >= now() - ($1::int * interval '1 hour')
        AND ($2::uuid IS NULL OR organization_id = $2)
      GROUP BY bucket
      ORDER BY bucket ASC
      `,
      [hours, organizationId ?? null]
    );
    return result.rows.map((row) => ({
      bucket: toIso(row.bucket),
      incidents: Number(row.incidents),
      critical: Number(row.critical),
      high: Number(row.high),
      open: Number(row.open)
    }));
  }

  async projectDetailSummary(filters: {
    organizationId: string;
    projectId: string;
    environment?: string;
    from?: string;
    to?: string;
  }) {
    const result = await db.query(
      `
      WITH bounds AS (
        SELECT
          COALESCE($4::timestamptz, now() - interval '24 hours') AS from_ts,
          COALESCE($5::timestamptz, now()) AS to_ts
      ),
      service_scope AS (
        SELECT *
        FROM services
        WHERE organization_id = $1
          AND project_id = $2
          AND ($3::text IS NULL OR environment = $3)
      ),
      metric_scope AS (
        SELECT m.*
        FROM metrics m, bounds b
        WHERE m.organization_id = $1
          AND m.project_id = $2
          AND ($3::text IS NULL OR m.environment = $3)
          AND m.timestamp >= b.from_ts
          AND m.timestamp <= b.to_ts
      ),
      aggregate_scope AS (
        SELECT a.*
        FROM metric_aggregates a, bounds b
        WHERE a.organization_id = $1
          AND a.project_id = $2
          AND ($3::text IS NULL OR a.environment = $3)
          AND a."window" = '1m'
          AND a.timestamp_bucket >= b.from_ts
          AND a.timestamp_bucket <= b.to_ts
      )
      SELECT
        (SELECT GREATEST(EXTRACT(EPOCH FROM (to_ts - from_ts)), 1)::float FROM bounds) AS "windowSeconds",
        (SELECT COUNT(*)::int FROM service_scope) AS "servicesCount",
        (SELECT COUNT(*)::int FROM service_scope WHERE health_status = 'healthy') AS "healthyServices",
        (SELECT COUNT(*)::int FROM service_scope WHERE health_status = 'degraded') AS "degradedServices",
        (SELECT COUNT(*)::int FROM service_scope WHERE health_status = 'down') AS "downServices",
        (
          SELECT COUNT(*)::int
          FROM incidents
          WHERE organization_id = $1
            AND project_id = $2
            AND status <> 'resolved'
        ) AS "activeIncidents",
        (SELECT COUNT(*)::int FROM logs l, bounds b WHERE l.organization_id = $1 AND l.project_id = $2 AND ($3::text IS NULL OR l.environment = $3) AND l.timestamp >= b.from_ts AND l.timestamp <= b.to_ts) AS "logsIngested",
        (SELECT COUNT(*)::int FROM metric_scope) AS "metricsIngested",
        (
          SELECT COALESCE(SUM(value), 0)::float
          FROM metric_scope
          WHERE metric_name IN ('http_requests_total', 'request_count', 'requestCount', 'worker_jobs_processed_total', 'service_events_total')
        ) AS "totalThroughput",
        (
          SELECT COALESCE(COUNT(*), 0)::float
          FROM metric_scope
          WHERE metric_name = 'http_request_duration_ms'
        ) AS "latencySamples",
        (
          SELECT COALESCE(
            (COUNT(*) FILTER (WHERE COALESCE(NULLIF(regexp_replace(COALESCE(labels->>'statusCode', labels->>'status_code', labels->>'status', '200'), '[^0-9]', '', 'g'), ''), '200')::int >= 400) * 100.0)
              / NULLIF(COUNT(*), 0),
            0
          )::float
          FROM metric_scope
          WHERE metric_name = 'http_request_duration_ms'
        ) AS "errorRate",
        (
          SELECT COALESCE(MAX(p50), 0)::float
          FROM aggregate_scope
          WHERE metric_name IN ('http_request_duration_ms', 'db_query_duration_ms', 'external_api_duration_ms', 'queue_job_duration_ms')
        ) AS "p50LatencyMs",
        (
          SELECT COALESCE(MAX(p95), 0)::float
          FROM aggregate_scope
          WHERE metric_name IN ('http_request_duration_ms', 'db_query_duration_ms', 'external_api_duration_ms', 'queue_job_duration_ms')
        ) AS "p95LatencyMs",
        (
          SELECT COALESCE(MAX(p99), 0)::float
          FROM aggregate_scope
          WHERE metric_name IN ('http_request_duration_ms', 'db_query_duration_ms', 'external_api_duration_ms', 'queue_job_duration_ms')
        ) AS "p99LatencyMs",
        (
          SELECT COALESCE((COUNT(*) FILTER (WHERE health_status = 'healthy') * 100.0) / NULLIF(COUNT(*), 0), 0)::float
          FROM service_scope
        ) AS "uptimePercent",
        (
          SELECT MAX(created_at)
          FROM deployments
          WHERE organization_id = $1
            AND project_id = $2
            AND ($3::text IS NULL OR environment = $3)
        ) AS "lastDeploymentAt"
      `,
      [filters.organizationId, filters.projectId, filters.environment ?? null, filters.from ?? null, filters.to ?? null]
    );
    const row = result.rows[0] ?? {};
    const windowSeconds = Math.max(Number(row.windowSeconds ?? 86_400), 1);
    const { windowSeconds: _windowSeconds, ...summary } = row;
    return {
      ...summary,
      requestsPerSecond:
        Number(row.totalThroughput ?? 0) > 0
          ? Number(row.totalThroughput) / windowSeconds
          : Number(row.latencySamples ?? 0) / windowSeconds,
      lastDeploymentAt: toIso(row.lastDeploymentAt)
    };
  }

  async serviceDetailSummary(filters: {
    organizationId: string;
    serviceId: string;
    environment?: string;
    from?: string;
    to?: string;
  }) {
    const result = await db.query(
      `
      WITH bounds AS (
        SELECT
          COALESCE($4::timestamptz, now() - interval '24 hours') AS from_ts,
          COALESCE($5::timestamptz, now()) AS to_ts
      ),
      metric_scope AS (
        SELECT m.*
        FROM metrics m, bounds b
        WHERE m.organization_id = $1
          AND m.service_id = $2
          AND ($3::text IS NULL OR m.environment = $3)
          AND m.timestamp >= b.from_ts
          AND m.timestamp <= b.to_ts
      ),
      aggregate_scope AS (
        SELECT a.*
        FROM metric_aggregates a, bounds b
        WHERE a.organization_id = $1
          AND a.service_id = $2
          AND ($3::text IS NULL OR a.environment = $3)
          AND a."window" = '1m'
          AND a.timestamp_bucket >= b.from_ts
          AND a.timestamp_bucket <= b.to_ts
      )
      SELECT
        (SELECT GREATEST(EXTRACT(EPOCH FROM (to_ts - from_ts)), 1)::float FROM bounds) AS "windowSeconds",
        (
          SELECT COALESCE(SUM(value), 0)::float
          FROM metric_scope
          WHERE metric_name IN ('http_requests_total', 'request_count', 'requestCount', 'worker_jobs_processed_total', 'service_events_total')
        ) AS "totalThroughput",
        (
          SELECT COALESCE(COUNT(*), 0)::float
          FROM metric_scope
          WHERE metric_name = 'http_request_duration_ms'
        ) AS "latencySamples",
        (
          SELECT COALESCE(
            (COUNT(*) FILTER (WHERE COALESCE(NULLIF(regexp_replace(COALESCE(labels->>'statusCode', labels->>'status_code', labels->>'status', '200'), '[^0-9]', '', 'g'), ''), '200')::int >= 400) * 100.0)
              / NULLIF(COUNT(*), 0),
            0
          )::float
          FROM metric_scope
          WHERE metric_name = 'http_request_duration_ms'
        ) AS "errorRate",
        (
          SELECT COALESCE(MAX(p50), 0)::float
          FROM aggregate_scope
          WHERE metric_name IN ('http_request_duration_ms', 'db_query_duration_ms', 'external_api_duration_ms', 'queue_job_duration_ms')
        ) AS "p50LatencyMs",
        (
          SELECT COALESCE(MAX(p95), 0)::float
          FROM aggregate_scope
          WHERE metric_name IN ('http_request_duration_ms', 'db_query_duration_ms', 'external_api_duration_ms', 'queue_job_duration_ms')
        ) AS "p95LatencyMs",
        (
          SELECT COALESCE(MAX(p99), 0)::float
          FROM aggregate_scope
          WHERE metric_name IN ('http_request_duration_ms', 'db_query_duration_ms', 'external_api_duration_ms', 'queue_job_duration_ms')
        ) AS "p99LatencyMs",
        (
          SELECT COUNT(*)::int
          FROM incidents
          WHERE organization_id = $1
            AND service_id = $2
            AND status <> 'resolved'
        ) AS "activeIncidents",
        (
          SELECT COUNT(*)::int
          FROM logs l, bounds b
          WHERE l.organization_id = $1
            AND l.service_id = $2
            AND ($3::text IS NULL OR l.environment = $3)
            AND l.timestamp >= b.from_ts
            AND l.timestamp <= b.to_ts
        ) AS "logVolume",
        (
          SELECT MAX(created_at)
          FROM deployments
          WHERE organization_id = $1
            AND service_id = $2
            AND ($3::text IS NULL OR environment = $3)
        ) AS "lastDeploymentAt",
        (
          SELECT MAX(timestamp)
          FROM logs l, bounds b
          WHERE l.organization_id = $1
            AND l.service_id = $2
            AND ($3::text IS NULL OR l.environment = $3)
            AND l.timestamp >= b.from_ts
            AND l.timestamp <= b.to_ts
        ) AS "lastLogAt",
        (
          SELECT MAX(timestamp)
          FROM metric_scope
        ) AS "lastMetricAt",
        (
          SELECT CASE
            WHEN health_status = 'healthy' THEN 100.0
            WHEN health_status = 'degraded' THEN 50.0
            WHEN health_status = 'down' THEN 0.0
            ELSE 0.0
          END::float
          FROM services
          WHERE organization_id = $1
            AND id = $2
        ) AS "uptimePercent"
      `,
      [filters.organizationId, filters.serviceId, filters.environment ?? null, filters.from ?? null, filters.to ?? null]
    );
    const row = result.rows[0] ?? {};
    const windowSeconds = Math.max(Number(row.windowSeconds ?? 86_400), 1);
    const { windowSeconds: _windowSeconds, ...summary } = row;
    return {
      ...summary,
      requestsPerSecond:
        Number(row.totalThroughput ?? 0) > 0
          ? Number(row.totalThroughput) / windowSeconds
          : Number(row.latencySamples ?? 0) / windowSeconds,
      lastDeploymentAt: toIso(row.lastDeploymentAt),
      lastLogAt: toIso(row.lastLogAt),
      lastMetricAt: toIso(row.lastMetricAt)
    };
  }

  toPublicUser(user: AuthUser) {
    return publicUser(user);
  }

  async createAiAnalysisResult(input: {
    incidentId: string;
    summary: string;
    likelyRootCause: string;
    confidenceScore: number;
    evidence: string[];
    recommendedActions: string[];
    rollbackRecommendation?: string;
    postmortemDraft?: string;
  }) {
    await db.query(`DELETE FROM ai_analysis_results WHERE incident_id = $1`, [input.incidentId]);
    const result = await db.query(
      `
      INSERT INTO ai_analysis_results (
        id, incident_id, summary, likely_root_cause, confidence, confidence_score, evidence, recommended_actions, rollback_recommendation, postmortem_draft
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id,
                incident_id AS "incidentId",
                summary,
                likely_root_cause AS "likelyRootCause",
                confidence_score AS "confidenceScore",
                evidence,
                recommended_actions AS "recommendedActions",
                rollback_recommendation AS "rollbackRecommendation",
                postmortem_draft AS "postmortemDraft",
                created_at AS "createdAt"
      `,
      [
        newId(),
        input.incidentId,
        input.summary,
        input.likelyRootCause,
        input.confidenceScore,
        input.confidenceScore,
        JSON.stringify(input.evidence),
        JSON.stringify(input.recommendedActions),
        input.rollbackRecommendation ?? null,
        input.postmortemDraft ?? null
      ]
    );
    return result.rows[0];
  }

  async createIncidentEvidence(input: {
    incidentId: string;
    evidenceType: string;
    sourceId?: string;
    title?: string;
    payload?: Record<string, unknown>;
  }) {
    const result = await db.query(
      `
      INSERT INTO incident_evidence (id, incident_id, evidence_type, source_id, title, payload)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id,
                incident_id AS "incidentId",
                evidence_type AS "evidenceType",
                source_id AS "sourceId",
                title,
                payload,
                created_at AS "createdAt"
      `,
      [
        newId(),
        input.incidentId,
        input.evidenceType,
        input.sourceId ?? null,
        input.title ?? null,
        JSON.stringify(input.payload ?? {})
      ]
    );
    return {
      ...result.rows[0],
      createdAt: toIso(result.rows[0].createdAt)
    };
  }

  async listLogs(filters: {
    organizationId?: string;
    projectId?: string;
    serviceId?: string;
    projectKey?: string;
    serviceName?: string;
    level?: string;
    environment?: string;
    traceId?: string;
    requestId?: string;
    route?: string;
    statusCode?: number;
    from?: string;
    to?: string;
    search?: string;
    limit?: number;
  }) {
    const limit = boundedLimit(filters.limit, 100, 500);
    const result = await db.query(
      `
      SELECT id,
             organization_id AS "organizationId",
             project_id AS "projectId",
             service_id AS "serviceId",
             project_key AS "projectKey",
             service_name AS "serviceName",
             level,
             message,
             trace_id AS "traceId",
             request_id AS "requestId",
             span_id AS "spanId",
             parent_span_id AS "parentSpanId",
             route,
             method,
             status_code AS "statusCode",
             duration_ms AS "durationMs",
             environment,
             metadata,
             timestamp,
             created_at AS "createdAt"
      FROM logs
      WHERE ($1::uuid IS NULL OR organization_id = $1)
        AND ($2::uuid IS NULL OR project_id = $2)
        AND ($3::uuid IS NULL OR service_id = $3)
        AND ($4::text IS NULL OR project_key = $4)
        AND ($5::text IS NULL OR service_name = $5)
        AND ($6::text IS NULL OR level = $6)
        AND ($7::text IS NULL OR environment = $7)
        AND ($8::text IS NULL OR trace_id = $8)
        AND ($9::text IS NULL OR request_id = $9)
        AND ($10::text IS NULL OR route = $10 OR metadata->>'route' = $10)
        AND ($11::int IS NULL OR status_code = $11 OR ((metadata->>'statusCode') ~ '^[0-9]+$' AND (metadata->>'statusCode')::int = $11))
        AND ($12::timestamptz IS NULL OR timestamp >= $12)
        AND ($13::timestamptz IS NULL OR timestamp <= $13)
        AND ($14::text IS NULL OR message ILIKE '%' || $14 || '%' OR metadata::text ILIKE '%' || $14 || '%')
      ORDER BY timestamp DESC
      LIMIT $15
      `,
      [
        filters.organizationId ?? null,
        filters.projectId ?? null,
        filters.serviceId ?? null,
        filters.projectKey ?? null,
        filters.serviceName ?? null,
        filters.level ?? null,
        filters.environment ?? null,
        filters.traceId ?? null,
        filters.requestId ?? null,
        filters.route ?? null,
        filters.statusCode ?? null,
        filters.from ?? null,
        filters.to ?? null,
        filters.search ?? null,
        limit
      ]
    );
    return result.rows;
  }

  async countLogsForAlert(filters: {
    organizationId: string;
    serviceId?: string;
    environment?: string;
    from?: string;
    levels?: string[];
    contains?: string;
  }) {
    const result = await db.query(
      `
      SELECT COUNT(*)::int AS count
      FROM logs
      WHERE organization_id = $1
        AND ($2::uuid IS NULL OR service_id = $2)
        AND ($3::text IS NULL OR environment = $3)
        AND ($4::timestamptz IS NULL OR timestamp >= $4)
        AND ($5::text[] IS NULL OR level = ANY($5))
        AND ($6::text IS NULL OR message ILIKE '%' || $6 || '%' OR metadata::text ILIKE '%' || $6 || '%')
      `,
      [
        filters.organizationId,
        filters.serviceId ?? null,
        filters.environment ?? null,
        filters.from ?? null,
        filters.levels && filters.levels.length > 0 ? filters.levels : null,
        filters.contains ?? null
      ]
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async listMetrics(filters: {
    organizationId?: string;
    projectId?: string;
    serviceId?: string;
    projectKey?: string;
    serviceName?: string;
    environment?: string;
    metricName?: string;
    from?: string;
    to?: string;
    limit?: number;
  }) {
    const limit = boundedLimit(filters.limit, 100, 1000);
    const result = await db.query(
      `
      SELECT id,
             organization_id AS "organizationId",
             project_id AS "projectId",
             service_id AS "serviceId",
             project_key AS "projectKey",
             service_name AS "serviceName",
             environment,
             metric_name AS "metricName",
             value,
             labels,
             timestamp,
             created_at AS "createdAt"
      FROM metrics
      WHERE ($1::uuid IS NULL OR organization_id = $1)
        AND ($2::uuid IS NULL OR project_id = $2)
        AND ($3::uuid IS NULL OR service_id = $3)
        AND ($4::text IS NULL OR project_key = $4)
        AND ($5::text IS NULL OR service_name = $5)
        AND ($6::text IS NULL OR environment = $6)
        AND ($7::text IS NULL OR metric_name = $7)
        AND ($8::timestamptz IS NULL OR timestamp >= $8)
        AND ($9::timestamptz IS NULL OR timestamp <= $9)
      ORDER BY timestamp DESC
      LIMIT $10
      `,
      [
        filters.organizationId ?? null,
        filters.projectId ?? null,
        filters.serviceId ?? null,
        filters.projectKey ?? null,
        filters.serviceName ?? null,
        filters.environment ?? null,
        filters.metricName ?? null,
        filters.from ?? null,
        filters.to ?? null,
        limit
      ]
    );
    return result.rows.map((row) => ({
      ...row,
      value: Number(row.value),
      timestamp: toIso(row.timestamp),
      createdAt: toIso(row.createdAt)
    }));
  }

  async listMetricAggregates(filters: {
    organizationId?: string;
    projectId?: string;
    serviceId?: string;
    projectKey?: string;
    serviceName?: string;
    environment?: string;
    metricName?: string;
    window?: string;
    from?: string;
    to?: string;
    limit?: number;
  }) {
    const limit = boundedLimit(filters.limit, 100, 1000);
    const result = await db.query(
      `
      SELECT id,
             organization_id AS "organizationId",
             project_id AS "projectId",
             service_id AS "serviceId",
             project_key AS "projectKey",
             service_name AS "serviceName",
             environment,
             metric_name AS "metricName",
             "window",
             timestamp_bucket AS "timestampBucket",
             count,
             sum,
             avg,
             min,
             max,
             p50,
             p95,
             p99,
             created_at AS "createdAt",
             updated_at AS "updatedAt"
      FROM metric_aggregates
      WHERE ($1::uuid IS NULL OR organization_id = $1)
        AND ($2::uuid IS NULL OR project_id = $2)
        AND ($3::uuid IS NULL OR service_id = $3)
        AND ($4::text IS NULL OR project_key = $4)
        AND ($5::text IS NULL OR service_name = $5)
        AND ($6::text IS NULL OR environment = $6)
        AND ($7::text IS NULL OR metric_name = $7)
        AND ($8::text IS NULL OR "window" = $8)
        AND ($9::timestamptz IS NULL OR timestamp_bucket >= $9)
        AND ($10::timestamptz IS NULL OR timestamp_bucket <= $10)
      ORDER BY timestamp_bucket DESC
      LIMIT $11
      `,
      [
        filters.organizationId ?? null,
        filters.projectId ?? null,
        filters.serviceId ?? null,
        filters.projectKey ?? null,
        filters.serviceName ?? null,
        filters.environment ?? null,
        filters.metricName ?? null,
        filters.window ?? null,
        filters.from ?? null,
        filters.to ?? null,
        limit
      ]
    );
    return result.rows.map((row) => ({
      ...row,
      count: Number(row.count),
      sum: Number(row.sum),
      avg: Number(row.avg),
      min: Number(row.min),
      max: Number(row.max),
      p50: Number(row.p50),
      p95: Number(row.p95),
      p99: Number(row.p99),
      timestampBucket: toIso(row.timestampBucket),
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt)
    }));
  }

  async getRoutePerformance(filters: {
    organizationId?: string;
    projectId?: string;
    serviceId?: string;
    environment?: string;
    from?: string;
    to?: string;
    sortBy?: string;
    limit?: number;
  }) {
    const limit = boundedLimit(filters.limit, 50, 200);
    const sortBy = filters.sortBy || "requestCount";
    const result = await db.query(
      `
      WITH metric_rows AS (
        SELECT
          labels->>'route' AS route,
          COALESCE(labels->>'method', 'GET') AS method,
          COALESCE(NULLIF(regexp_replace(COALESCE(labels->>'statusCode', labels->>'status_code', labels->>'status', '200'), '[^0-9]', '', 'g'), ''), '200')::int AS status_code,
          value AS duration_ms,
          timestamp
        FROM metrics
        WHERE metric_name = 'http_request_duration_ms'
          AND ($1::uuid IS NULL OR organization_id = $1)
          AND ($2::uuid IS NULL OR project_id = $2)
          AND ($3::uuid IS NULL OR service_id = $3)
          AND ($4::text IS NULL OR environment = $4)
          AND ($5::timestamptz IS NULL OR timestamp >= $5)
          AND ($6::timestamptz IS NULL OR timestamp <= $6)
          AND labels->>'route' IS NOT NULL
      ),
      log_rows AS (
        SELECT
          route,
          COALESCE(method, 'GET') AS method,
          status_code,
          duration_ms,
          timestamp
        FROM logs
        WHERE route IS NOT NULL
          AND ($1::uuid IS NULL OR organization_id = $1)
          AND ($2::uuid IS NULL OR project_id = $2)
          AND ($3::uuid IS NULL OR service_id = $3)
          AND ($4::text IS NULL OR environment = $4)
          AND ($5::timestamptz IS NULL OR timestamp >= $5)
          AND ($6::timestamptz IS NULL OR timestamp <= $6)
      ),
      combined AS (
        SELECT * FROM metric_rows
        UNION ALL
        SELECT *
        FROM log_rows lr
        WHERE NOT EXISTS (
          SELECT 1
          FROM metric_rows mr
          WHERE mr.route = lr.route
            AND mr.method = lr.method
        )
      )
      SELECT
        route,
        method,
        COUNT(*)::int AS "requestCount",
        COALESCE(AVG(duration_ms) FILTER (WHERE duration_ms IS NOT NULL), 0)::double precision AS "avgLatency",
        COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE duration_ms IS NOT NULL), 0)::double precision AS "p95Latency",
        SUM(CASE WHEN COALESCE(status_code, 200) >= 400 THEN 1 ELSE 0 END)::int AS "errorCount",
        AVG(CASE WHEN COALESCE(status_code, 200) >= 400 THEN 100.0 ELSE 0.0 END)::double precision AS "errorRate",
        SUM(CASE WHEN COALESCE(status_code, 200) >= 200 AND COALESCE(status_code, 200) < 300 THEN 1 ELSE 0 END)::int AS "status2xx",
        SUM(CASE WHEN COALESCE(status_code, 200) >= 400 AND COALESCE(status_code, 200) < 500 THEN 1 ELSE 0 END)::int AS "status4xx",
        SUM(CASE WHEN COALESCE(status_code, 200) >= 500 AND COALESCE(status_code, 200) < 600 THEN 1 ELSE 0 END)::int AS "status5xx",
        MAX(timestamp) AS "lastSeen"
      FROM combined
      GROUP BY route, method
      ORDER BY 
        CASE WHEN $7 = 'requestCount' THEN COUNT(*) END DESC,
        CASE WHEN $7 = 'avgLatency' THEN AVG(duration_ms) END DESC,
        CASE WHEN $7 = 'p95Latency' THEN percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) END DESC,
        CASE WHEN $7 = 'errorRate' THEN AVG(CASE WHEN COALESCE(status_code, 200) >= 400 THEN 100.0 ELSE 0.0 END) END DESC,
        CASE WHEN $7 = 'errorCount' THEN SUM(CASE WHEN COALESCE(status_code, 200) >= 400 THEN 1 ELSE 0 END) END DESC,
        route ASC
      LIMIT $8
      `,
      [
        filters.organizationId ?? null,
        filters.projectId ?? null,
        filters.serviceId ?? null,
        filters.environment ?? null,
        filters.from ?? null,
        filters.to ?? null,
        sortBy,
        limit
      ]
    );

    return result.rows.map((row) => ({
      ...row,
      requestCount: Number(row.requestCount),
      avgLatency: row.avgLatency ? Number(row.avgLatency.toFixed(2)) : 0,
      p95Latency: row.p95Latency ? Number(row.p95Latency.toFixed(2)) : 0,
      errorCount: Number(row.errorCount ?? 0),
      errorRate: row.errorRate ? Number(row.errorRate.toFixed(2)) : 0,
      status2xx: Number(row.status2xx ?? 0),
      status4xx: Number(row.status4xx ?? 0),
      status5xx: Number(row.status5xx ?? 0),
      lastSeen: toIso(row.lastSeen)
    }));
  }
}

export const platformRepository = new PlatformRepository();
