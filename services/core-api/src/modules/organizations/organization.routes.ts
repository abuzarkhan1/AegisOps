import { Router } from "express";
import { asyncHandler } from "../../shared/http/asyncHandler";
import { notFound } from "../../shared/http/errors";
import { optionalObject, optionalString, organizationPlan, requiredString, userRole } from "../../shared/http/requestValidation";
import { platformRepository } from "../platform/repositories/platform.repository";
import { authService } from "../platform/services/auth.service";
import { cache } from "../../infrastructure/redis/cache";
import { redisKeyPatterns } from "../../utils/cacheKeys";

export const organizationRouter = Router();

organizationRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json({ organizations: await platformRepository.listOrganizations() });
  })
);

organizationRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const actor = await authService.verifyAuthorizationHeader(req.header("authorization")).catch(() => undefined);
    const organization = await platformRepository.createOrganization({
      name: requiredString(req.body, "name"),
      plan: organizationPlan(req.body.plan),
      settings: optionalObject(req.body, "settings"),
      ownerId: actor?.id
    });
    res.status(201).json({ organization });
  })
);
organizationRouter.get(
  "/:orgId",
  asyncHandler(async (req, res) => {
    const orgId = req.params.orgId;
    const cacheKey = redisKeyPatterns.orgProfile(orgId);
    const cached = await cache.get<any>(cacheKey);
    if (cached) {
      res.json({ organization: cached });
      return;
    }
    const organization = await platformRepository.getOrganization(orgId);
    if (!organization) throw notFound("Organization");
    await cache.set(cacheKey, organization, 600); // 10 mins TTL
    await cache.set(redisKeyPatterns.orgSettings(orgId), organization, 600);
    res.json({ organization });
  })
);

organizationRouter.patch(
  "/:orgId",
  asyncHandler(async (req, res) => {
    const orgId = req.params.orgId;
    const organization = await platformRepository.updateOrganization(orgId, {
      name: optionalString(req.body, "name"),
      plan: organizationPlan(req.body.plan),
      settings: optionalObject(req.body, "settings")
    });
    if (!organization) throw notFound("Organization");

    // Invalidate caches
    await cache.delete(redisKeyPatterns.orgProfile(orgId));
    await cache.delete(redisKeyPatterns.orgSettings(orgId));
    await cache.delete(redisKeyPatterns.orgDashboardSummary(orgId));
    await cache.delete(redisKeyPatterns.orgDashboardSummary("default"));

    res.json({ organization });
  })
);

organizationRouter.get(
  "/:orgId/users",
  asyncHandler(async (req, res) => {
    const orgId = req.params.orgId;
    const cacheKey = `org:${orgId}:members`;
    const cached = await cache.get<any>(cacheKey);
    if (cached) {
      res.json({ users: cached });
      return;
    }
    const users = await platformRepository.listOrganizationMembers(orgId);
    await cache.set(cacheKey, users, 300); // 5 mins TTL
    res.json({ users });
  })
);
organizationRouter.post(
  "/:orgId/users/invite",
  asyncHandler(async (req, res) => {
    const orgId = req.params.orgId;
    const email = requiredString(req.body, "email");
    const existingUser = await platformRepository.findUserByEmail(email);
    const user =
      existingUser ??
      (await platformRepository.createUser({
        email,
        name: optionalString(req.body, "name") ?? email.split("@")[0],
        passwordHash: "invited-user-must-set-password",
        role: userRole(req.body.role)
      }));
    await platformRepository.addOrganizationMember({
      organizationId: orgId,
      userId: user.id,
      role: userRole(req.body.role)
    });
    await platformRepository.audit({
      organizationId: orgId,
      action: "organization.user.invited",
      resourceType: "user",
      resourceId: user.id,
      metadata: { role: userRole(req.body.role) }
    });

    // Invalidate members cache
    await cache.delete(`org:${orgId}:members`);

    res.status(202).json({ invitation: { status: "accepted", user: platformRepository.toPublicUser(user) } });
  })
);

organizationRouter.patch(
  "/:orgId/users/:userId/role",
  asyncHandler(async (req, res) => {
    const orgId = req.params.orgId;
    const userId = req.params.userId;
    const role = userRole(req.body.role);
    const updated = await platformRepository.updateOrganizationMemberRole({
      organizationId: orgId,
      userId,
      role
    });
    if (!updated) throw notFound("Organization member");
    await platformRepository.audit({
      organizationId: orgId,
      action: "organization.user.role_updated",
      resourceType: "user",
      resourceId: userId,
      metadata: { role }
    });

    // Invalidate caches
    await cache.delete(redisKeyPatterns.userPermissions(userId));
    await cache.delete(`org:${orgId}:members`);

    res.json({ status: "updated", userId, role });
  })
);

organizationRouter.delete(
  "/:orgId/users/:userId",
  asyncHandler(async (req, res) => {
    const orgId = req.params.orgId;
    const userId = req.params.userId;
    const removed = await platformRepository.removeOrganizationMember({
      organizationId: orgId,
      userId
    });
    if (!removed) throw notFound("Organization member");
    await platformRepository.audit({
      organizationId: orgId,
      action: "organization.user.removed",
      resourceType: "user",
      resourceId: userId
    });

    // Invalidate caches
    await cache.delete(redisKeyPatterns.userPermissions(userId));
    await cache.delete(`org:${orgId}:members`);

    res.status(204).send();
  })
);
