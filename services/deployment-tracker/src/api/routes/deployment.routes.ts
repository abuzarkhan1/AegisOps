import { Router } from "express";
import { deploymentWebhookCounter, metricsRegistry } from "../../infrastructure/metrics/registry";
import { checkKafka, publishDeployment } from "../../infrastructure/kafka/client";
import { deploymentRepository } from "../../modules/deployments/repositories/deployment.repository";
import { env } from "../../config/env";
import { asyncHandler } from "../../shared/http/asyncHandler";

export const deploymentRouter = Router();

const acceptDeployment = async (provider: "github" | "gitlab", body: Record<string, unknown>, res: import("express").Response) => {
  const deployment = await deploymentRepository.create(provider, {
    organizationId: typeof body.organizationId === "string" ? body.organizationId : undefined,
    projectId: typeof body.projectId === "string" ? body.projectId : undefined,
    serviceId: typeof body.serviceId === "string" ? body.serviceId : undefined,
    serviceName: typeof body.serviceName === "string" ? body.serviceName : typeof body.repository === "string" ? body.repository : undefined,
    environment: typeof body.environment === "string" ? body.environment : "development",
    version: typeof body.version === "string" ? body.version : undefined,
    commitSha: typeof body.commitSha === "string" ? body.commitSha : typeof body.after === "string" ? body.after : undefined,
    branch: typeof body.branch === "string" ? body.branch : typeof body.ref === "string" ? body.ref.replace(/^refs\/heads\//, "") : undefined,
    status: typeof body.status === "string" ? body.status : "completed",
    deployedBy: typeof body.deployedBy === "string" ? body.deployedBy : undefined,
    repository: typeof body.repository === "string" ? body.repository : undefined,
    metadata: body
  });

  await publishDeployment(deployment, `${deployment.serviceName}:${deployment.environment}`);
  deploymentWebhookCounter.inc({ provider, environment: deployment.environment });
  res.status(202).json({ status: "accepted", topic: "deployments.created", deployment });
};

deploymentRouter.get("/health", asyncHandler(async (_req, res) => {
  const checks = {
    kafka: await checkKafka(),
    rabbitmqConfigured: { status: env.RABBITMQ_URL ? "ok" : "degraded", detail: env.RABBITMQ_URL ? undefined : "RABBITMQ_URL is not set" }
  };
  const degraded = Object.values(checks).some((check) => check.status !== "ok");

  res.json({
    status: degraded ? "degraded" : "ok",
    service: env.SERVICE_NAME,
    publishes: ["deployments.created"],
    checks
  });
}));

deploymentRouter.get("/metrics", async (_req, res) => {
  res.setHeader("Content-Type", metricsRegistry.contentType);
  res.send(await metricsRegistry.metrics());
});

deploymentRouter.post("/webhooks/github", asyncHandler((req, res) => acceptDeployment("github", req.body, res)));
deploymentRouter.post("/webhooks/gitlab", asyncHandler((req, res) => acceptDeployment("gitlab", req.body, res)));
deploymentRouter.post("/github", asyncHandler((req, res) => acceptDeployment("github", req.body, res)));
deploymentRouter.post("/gitlab", asyncHandler((req, res) => acceptDeployment("gitlab", req.body, res)));
deploymentRouter.post("/deployments/github", asyncHandler((req, res) => acceptDeployment("github", req.body, res)));
deploymentRouter.post("/deployments/gitlab", asyncHandler((req, res) => acceptDeployment("gitlab", req.body, res)));

deploymentRouter.get("/deployments", asyncHandler(async (_req, res) => {
  res.json({ deployments: await deploymentRepository.list() });
}));

deploymentRouter.get("/deployments/:deploymentId", asyncHandler(async (req, res) => {
  const deployment = await deploymentRepository.get(req.params.deploymentId);
  if (!deployment) {
    res.status(404).json({ status: "error", message: "Deployment not found" });
    return;
  }
  res.json({ deployment });
}));

deploymentRouter.get("/deployments/:deploymentId/impact", asyncHandler(async (req, res) => {
  const impact = await deploymentRepository.impact(req.params.deploymentId);
  if (!impact) {
    res.status(404).json({ status: "error", message: "Deployment not found" });
    return;
  }
  res.json({ impact });
}));

deploymentRouter.post("/deployments/:deploymentId/impact", asyncHandler(async (req, res) => {
  const impact = await deploymentRepository.saveImpact(req.params.deploymentId, req.body);
  if (!impact) {
    res.status(404).json({ status: "error", message: "Deployment not found" });
    return;
  }
  res.status(201).json({ status: "success", impact });
}));

deploymentRouter.post("/:deploymentId/impact", asyncHandler(async (req, res) => {
  const impact = await deploymentRepository.saveImpact(req.params.deploymentId, req.body);
  if (!impact) {
    res.status(404).json({ status: "error", message: "Deployment not found" });
    return;
  }
  res.status(201).json({ status: "success", impact });
}));
