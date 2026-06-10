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
  name,
  environment,
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
  description: row.description ?? undefined,
  createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
  updatedAt: toIso(row.updatedAt) ?? new Date().toISOString()
});

const normalizeService = (row: any): ServiceRecord => ({
  ...row,
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

  async createProject(input: { organizationId: string; name: string; environment?: string; description?: string }) {
    const result = await db.query(
      `
      INSERT INTO projects (id, organization_id, name, environment, description)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING ${projectFields}
      `,
      [newId(), input.organizationId, input.name, input.environment ?? "dev", input.description ?? null]
    );
    return normalizeProject(result.rows[0]);
  }

  async listProjects(environment?: string) {
    const result = await db.query(
      `
      SELECT ${projectFields}
      FROM projects
      WHERE ($1::text IS NULL OR environment = $1)
      ORDER BY created_at DESC
      `,
      [environment ?? null]
    );
    return result.rows.map(normalizeProject);
  }

  async getProject(projectId: string) {
    const result = await db.query(`SELECT ${projectFields} FROM projects WHERE id = $1`, [projectId]);
    return result.rows[0] ? normalizeProject(result.rows[0]) : undefined;
  }

  async updateProject(projectId: string, patch: { name?: string; environment?: string; description?: string }) {
    const existing = await this.getProject(projectId);
    if (!existing) return undefined;
    const result = await db.query(
      `
      UPDATE projects
      SET name = $2,
          environment = $3,
          description = $4,
          updated_at = now()
      WHERE id = $1
      RETURNING ${projectFields}
      `,
      [projectId, patch.name ?? existing.name, patch.environment ?? existing.environment, patch.description ?? existing.description ?? null]
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
    serviceType?: ServiceType;
    language?: string;
    repositoryUrl?: string;
  }) {
    const result = await db.query(
      `
      INSERT INTO services (id, organization_id, project_id, name, slug, service_type, language, repository_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING ${serviceFields}
      `,
      [
        newId(),
        input.organizationId,
        input.projectId,
        input.name,
        slugify(input.name),
        input.serviceType ?? "api",
        input.language ?? null,
        input.repositoryUrl ?? null
      ]
    );
    return normalizeService(result.rows[0]);
  }

  async listServices(projectId?: string) {
    const result = await db.query(
      `
      SELECT ${serviceFields}
      FROM services
      WHERE ($1::uuid IS NULL OR project_id = $1)
      ORDER BY created_at DESC
      `,
      [projectId ?? null]
    );
    return result.rows.map(normalizeService);
  }

  async getService(serviceId: string) {
    const result = await db.query(`SELECT ${serviceFields} FROM services WHERE id = $1`, [serviceId]);
    return result.rows[0] ? normalizeService(result.rows[0]) : undefined;
  }

  async updateService(
    serviceId: string,
    patch: Partial<Pick<ServiceRecord, "name" | "serviceType" | "language" | "repositoryUrl" | "healthStatus">>
  ) {
    const existing = await this.getService(serviceId);
    if (!existing) return undefined;
    const result = await db.query(
      `
      UPDATE services
      SET name = $2,
          slug = $3,
          service_type = $4,
          language = $5,
          repository_url = $6,
          health_status = $7,
          updated_at = now()
      WHERE id = $1
      RETURNING ${serviceFields}
      `,
      [
        serviceId,
        patch.name ?? existing.name,
        patch.name ? slugify(patch.name) : existing.slug,
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

  async listApiKeys(serviceId?: string) {
    const result = await db.query(
      `
      SELECT ${apiKeyFields}
      FROM api_keys
      WHERE ($1::uuid IS NULL OR service_id = $1)
      ORDER BY created_at DESC
      `,
      [serviceId ?? null]
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

  async listAuditLogs() {
    const result = await db.query(`SELECT ${auditFields} FROM audit_logs ORDER BY created_at DESC LIMIT 200`);
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
        (SELECT COUNT(*)::int FROM services WHERE ($1::uuid IS NULL OR organization_id = $1)) AS "servicesMonitored",
        (SELECT COUNT(*)::int FROM services WHERE health_status = 'healthy' AND ($1::uuid IS NULL OR organization_id = $1)) AS "healthyServices",
        (SELECT COUNT(*)::int FROM services WHERE health_status = 'degraded' AND ($1::uuid IS NULL OR organization_id = $1)) AS "degradedServices",
        (SELECT COUNT(*)::int FROM services WHERE health_status = 'down' AND ($1::uuid IS NULL OR organization_id = $1)) AS "downServices",
        (SELECT COUNT(*)::int FROM alert_rules WHERE enabled = true AND ($1::uuid IS NULL OR organization_id = $1)) AS "alertRulesEnabled"
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

  async listLogs(filters: {
    serviceName?: string;
    level?: string;
    environment?: string;
    traceId?: string;
    route?: string;
    statusCode?: number;
    from?: string;
    to?: string;
    search?: string;
    limit?: number;
  }) {
    const limit = filters.limit ?? 100;
    const result = await db.query(
      `
      SELECT id,
             service_name AS "serviceName",
             level,
             message,
             trace_id AS "traceId",
             environment,
             metadata,
             timestamp,
             created_at AS "createdAt"
      FROM logs
      WHERE ($1::text IS NULL OR service_name = $1)
        AND ($2::text IS NULL OR level = $2)
        AND ($3::text IS NULL OR environment = $3)
        AND ($4::text IS NULL OR trace_id = $4)
        AND ($5::text IS NULL OR metadata->>'route' = $5)
        AND ($6::int IS NULL OR ((metadata->>'statusCode') ~ '^[0-9]+$' AND (metadata->>'statusCode')::int = $6))
        AND ($7::timestamptz IS NULL OR timestamp >= $7)
        AND ($8::timestamptz IS NULL OR timestamp <= $8)
        AND ($9::text IS NULL OR message ILIKE '%' || $9 || '%' OR metadata::text ILIKE '%' || $9 || '%')
      ORDER BY timestamp DESC
      LIMIT $10
      `,
      [
        filters.serviceName ?? null,
        filters.level ?? null,
        filters.environment ?? null,
        filters.traceId ?? null,
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
}

export const platformRepository = new PlatformRepository();
