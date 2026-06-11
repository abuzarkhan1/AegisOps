import { Request, Response, NextFunction } from "express";
import { authService } from "../../modules/platform/services/auth.service";
import { platformRepository } from "../../modules/platform/repositories/platform.repository";
import { db } from "../../infrastructure/database/pool";
import { HttpError } from "./errors";
import { asyncHandler } from "./asyncHandler";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const stringValue = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

const requestValue = (req: Request, key: string) =>
  stringValue(req.params[key]) ?? stringValue(req.query[key]) ?? stringValue(req.body?.[key]);

async function resourceOrganization(req: Request) {
  const projectId = requestValue(req, "projectId");
  if (projectId && uuidPattern.test(projectId)) {
    const project = await platformRepository.getProject(projectId);
    if (project) return project.organizationId;
  }

  const serviceId = requestValue(req, "serviceId");
  if (serviceId && uuidPattern.test(serviceId)) {
    const service = await platformRepository.getService(serviceId);
    if (service) return service.organizationId;
  }

  const incidentId = requestValue(req, "incidentId");
  if (incidentId && uuidPattern.test(incidentId)) {
    const incident = await platformRepository.getIncident(incidentId);
    if (incident) return incident.organizationId;
  }

  return undefined;
}

async function assertResourceScope(req: Request, organizationId: string) {
  const projectId = requestValue(req, "projectId");
  let project: Awaited<ReturnType<typeof platformRepository.getProject>> | undefined;
  if (projectId && uuidPattern.test(projectId)) {
    project = await platformRepository.getProject(projectId);
    if (project && project.organizationId !== organizationId) {
      throw new HttpError(403, "Project does not belong to this organization");
    }
  }

  const serviceId = requestValue(req, "serviceId");
  let service: Awaited<ReturnType<typeof platformRepository.getService>> | undefined;
  if (serviceId && uuidPattern.test(serviceId)) {
    service = await platformRepository.getService(serviceId);
    if (service && service.organizationId !== organizationId) {
      throw new HttpError(403, "Service does not belong to this organization");
    }
  }

  if (project && service && service.projectId !== project.id) {
    throw new HttpError(403, "Service does not belong to this project");
  }

  const incidentId = requestValue(req, "incidentId");
  if (incidentId && uuidPattern.test(incidentId)) {
    const incident = await platformRepository.getIncident(incidentId);
    if (incident && incident.organizationId !== organizationId) {
      throw new HttpError(403, "Incident does not belong to this organization");
    }
  }
}

export const requireOrganizationContext = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.header("authorization");

  let user: any = undefined;
  if (authHeader) {
    try {
      user = await authService.verifyAuthorizationHeader(authHeader);
      (req as any).user = user;
    } catch (err) {
      throw new HttpError(401, "Invalid or expired token");
    }
  }

  let orgId = requestValue(req, "organizationId") ?? (await resourceOrganization(req));

  // 2. Enforce scoping
  if (user) {
    if (orgId) {
      const isMember = await platformRepository.checkOrganizationMember(orgId, user.id);
      if (!isMember) {
        throw new HttpError(403, "You do not have access to this organization");
      }
    } else {
      const members = await db.query(
        "SELECT organization_id AS \"organizationId\" FROM organization_members WHERE user_id = $1 LIMIT 1",
        [user.id]
      );
      if (members.rows.length > 0) {
        orgId = members.rows[0].organizationId;
      } else {
        throw new HttpError(403, "User is not a member of any organization");
      }
    }
  } else {
    // Local / demo mode fallback:
    if (!orgId) {
      const orgs = await platformRepository.listOrganizations();
      if (orgs.length > 0) {
        orgId = orgs[0].id;
      }
    }
  }

  if (orgId) {
    await assertResourceScope(req, orgId);
    (req.query as any).organizationId = orgId;
    if (req.body && typeof req.body === "object") {
      req.body.organizationId = orgId;
    }
  }

  next();
});
