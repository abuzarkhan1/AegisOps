import client from "prom-client";
import { env } from "../../config/env";

export const metricsRegistry = new client.Registry();

client.collectDefaultMetrics({ register: metricsRegistry });
metricsRegistry.setDefaultLabels({ service: env.SERVICE_NAME });

export const httpRequestsTotal = new client.Counter({
  name: "aegisops_core_api_http_requests_total",
  help: "Total Core API HTTP requests",
  labelNames: ["method", "route", "status_code"]
});

metricsRegistry.registerMetric(httpRequestsTotal);

