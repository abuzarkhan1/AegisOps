import client from "prom-client";
import { env } from "../../config/env";

export const metricsRegistry = new client.Registry();
client.collectDefaultMetrics({ register: metricsRegistry });
metricsRegistry.setDefaultLabels({ service: env.SERVICE_NAME });

export const deploymentWebhookCounter = new client.Counter({
  name: "aegisops_deployment_webhooks_total",
  help: "Total deployment webhook events received",
  labelNames: ["provider", "environment"]
});

metricsRegistry.registerMetric(deploymentWebhookCounter);

