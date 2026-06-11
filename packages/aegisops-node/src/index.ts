import { randomUUID } from "node:crypto";
import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from "express";

export type AegisOpsConfig = {
  enabled?: boolean;
  apiUrl?: string;
  apiKey?: string;
  projectKey?: string;
  serviceName?: string;
  environment?: "development" | "staging" | "production" | string;
  captureRequestBody?: boolean;
  captureResponseBody?: boolean;
  captureHeaders?: boolean;
  ignoredRoutes?: string[];
  slowRequestThresholdMs?: number;
  flushIntervalMs?: number;
  batchSize?: number;
  debug?: boolean;
  timeoutMs?: number;
};

export type LogInput = {
  level?: "debug" | "info" | "warn" | "error" | string;
  message: string;
  traceId?: string;
  requestId?: string;
  route?: string;
  method?: string;
  statusCode?: number;
  durationMs?: number;
  timestamp?: string;
  metadata?: Record<string, unknown>;
};

export type MetricInput = {
  metricName: string;
  value: number;
  labels?: Record<string, string>;
  timestamp?: string;
};

export type AegisOpsClient = {
  sendLog(input: LogInput): Promise<void>;
  sendMetric(input: MetricInput): Promise<void>;
  sendBatchMetrics(inputs: MetricInput[]): Promise<void>;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
  middleware(): RequestHandler;
  errorHandler(): ErrorRequestHandler;
};

type NormalizedConfig = {
  enabled: boolean;
  apiUrl: string;
  apiKey?: string;
  projectKey?: string;
  serviceName?: string;
  environment: string;
  captureRequestBody: boolean;
  captureResponseBody: boolean;
  captureHeaders: boolean;
  ignoredRoutes: string[];
  slowRequestThresholdMs: number;
  flushIntervalMs: number;
  batchSize: number;
  debug: boolean;
  timeoutMs: number;
};

type RequestState = {
  startedAt: bigint;
  requestId: string;
  traceId: string;
};

const requestState = Symbol.for("aegisops.requestState");
const defaultIgnoredRoutes = ["/health", "/metrics", "/favicon.ico"];
const clients = new Set<AegisOpsClientImpl>();
let signalHandlersInstalled = false;

const parseBoolean = (value: unknown, fallback: boolean) => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  return fallback;
};

const normalizeConfig = (config: AegisOpsConfig = {}): NormalizedConfig => ({
  apiUrl: (config.apiUrl ?? process.env.AEGISOPS_API_URL ?? "http://localhost:8080").replace(/\/+$/, ""),
  apiKey: config.apiKey ?? process.env.AEGISOPS_API_KEY,
  projectKey: config.projectKey ?? process.env.AEGISOPS_PROJECT_KEY,
  serviceName: config.serviceName ?? process.env.AEGISOPS_SERVICE_NAME,
  environment: config.environment ?? process.env.AEGISOPS_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
  enabled: config.enabled ?? parseBoolean(process.env.AEGISOPS_ENABLED, true),
  captureRequestBody: config.captureRequestBody ?? false,
  captureResponseBody: config.captureResponseBody ?? false,
  captureHeaders: config.captureHeaders ?? false,
  ignoredRoutes: config.ignoredRoutes ?? defaultIgnoredRoutes,
  slowRequestThresholdMs: config.slowRequestThresholdMs ?? 1000,
  flushIntervalMs: config.flushIntervalMs ?? 5000,
  batchSize: config.batchSize ?? 20,
  debug: config.debug ?? false,
  timeoutMs: config.timeoutMs ?? 1500
});

const canSend = (config: NormalizedConfig) =>
  Boolean(config.enabled && config.apiKey && config.projectKey && config.serviceName);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const debugWarn = (config: NormalizedConfig, message: string, error?: unknown) => {
  if (!config.debug) return;
  const detail = error instanceof Error ? error.message : error;
  if (detail) {
    console.warn(`[aegisops] ${message}`, detail);
  } else {
    console.warn(`[aegisops] ${message}`);
  }
};

const shouldIgnoreRoute = (config: NormalizedConfig, req: Request) => {
  const path = req.path || req.originalUrl.split("?")[0] || "/";
  return config.ignoredRoutes.some((route) => path === route || path.startsWith(`${route}/`));
};

const headerValue = (req: Request, header: string) => {
  const value = req.header(header);
  return value && value.trim() ? value.trim() : undefined;
};

const requestIdFromHeaders = (req: Request) =>
  headerValue(req, "x-request-id") ?? headerValue(req, "x-correlation-id") ?? randomUUID();

const traceIdFromHeaders = (req: Request) =>
  headerValue(req, "x-trace-id") ?? headerValue(req, "traceparent") ?? randomUUID();

const routeName = (req: Request) => {
  const routePath = typeof req.route?.path === "string" ? req.route.path : undefined;
  return routePath ? `${req.baseUrl}${routePath}` || req.path : req.originalUrl.split("?")[0] || req.path;
};

const requestDurationMs = (req: Request) => {
  const state = (req as unknown as Record<symbol, RequestState>)[requestState];
  if (!state) return undefined;
  return Number(process.hrtime.bigint() - state.startedAt) / 1_000_000;
};

const labelsForRequest = (req: Request, res: Response, route: string) => ({
  method: req.method,
  route,
  statusCode: String(res.statusCode)
});

const safeHeaders = (headers: Record<string, unknown>) => {
  const redacted = { ...headers };
  for (const key of Object.keys(redacted)) {
    if (["authorization", "cookie", "set-cookie", "x-api-key"].includes(key.toLowerCase())) {
      redacted[key] = "[redacted]";
    }
  }
  return redacted;
};

const responseBodyCapture = (res: Response) => {
  const chunks: Buffer[] = [];
  const originalWrite = res.write.bind(res) as Response["write"];
  const originalEnd = res.end.bind(res) as Response["end"];

  (res as unknown as { write: Response["write"] }).write = ((chunk: unknown, ...args: unknown[]) => {
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    return originalWrite(chunk as never, ...(args as never[]));
  }) as Response["write"];

  (res as unknown as { end: Response["end"] }).end = ((chunk: unknown, ...args: unknown[]) => {
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    return originalEnd(chunk as never, ...(args as never[]));
  }) as Response["end"];

  return () => Buffer.concat(chunks).toString("utf8").slice(0, 64_000);
};

const installSignalHandlers = () => {
  if (signalHandlersInstalled) return;
  signalHandlersInstalled = true;
  const flushAll = () => Promise.allSettled([...clients].map((client) => client.flush())).then(() => undefined);
  process.once("SIGINT", () => {
    void flushAll();
  });
  process.once("SIGTERM", () => {
    void flushAll();
  });
};

class AegisOpsClientImpl implements AegisOpsClient {
  private readonly config: NormalizedConfig;
  private readonly metricQueue: MetricInput[] = [];
  private flushing = false;
  private readonly timer?: NodeJS.Timeout;

  constructor(config: AegisOpsConfig = {}) {
    this.config = normalizeConfig(config);
    clients.add(this);
    installSignalHandlers();
    if (this.config.enabled && this.config.flushIntervalMs > 0) {
      this.timer = setInterval(() => {
        void this.flush();
      }, this.config.flushIntervalMs);
      this.timer.unref?.();
    }
  }

  async sendLog(input: LogInput) {
    if (!canSend(this.config)) {
      debugWarn(this.config, "log dropped because SDK is disabled or config is incomplete");
      return;
    }
    await this.postJSON("/ingest/logs", {
      projectKey: this.config.projectKey,
      serviceName: this.config.serviceName,
      environment: this.config.environment,
      level: input.level ?? "info",
      message: input.message,
      traceId: input.traceId,
      requestId: input.requestId,
      route: input.route,
      method: input.method,
      statusCode: input.statusCode,
      durationMs: input.durationMs,
      timestamp: input.timestamp ?? new Date().toISOString(),
      metadata: input.metadata ?? {}
    });
  }

  async sendMetric(input: MetricInput) {
    await this.sendBatchMetrics([input]);
  }

  async sendBatchMetrics(inputs: MetricInput[]) {
    if (!canSend(this.config)) {
      debugWarn(this.config, "metrics dropped because SDK is disabled or config is incomplete");
      return;
    }
    if (inputs.length === 0) return;
    for (const input of inputs) {
      this.metricQueue.push({
        ...input,
        labels: input.labels ?? {},
        timestamp: input.timestamp ?? new Date().toISOString()
      });
    }
    if (this.metricQueue.length >= this.config.batchSize) {
      await this.flush();
    }
  }

  async flush() {
    if (this.flushing || !canSend(this.config) || this.metricQueue.length === 0) return;
    this.flushing = true;
    const batch = this.metricQueue.splice(0, this.config.batchSize);
    try {
      await this.postJSON("/metrics-api/metrics/batch", {
        projectKey: this.config.projectKey,
        serviceName: this.config.serviceName,
        environment: this.config.environment,
        metrics: batch
      });
    } catch {
      // postJSON is fail-safe, but keep the queue draining even if this changes later.
    } finally {
      this.flushing = false;
    }
    if (this.metricQueue.length >= this.config.batchSize) {
      await this.flush();
    }
  }

  async shutdown() {
    if (this.timer) clearInterval(this.timer);
    await this.flush();
    clients.delete(this);
  }

  middleware(): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
      const state: RequestState = {
        startedAt: process.hrtime.bigint(),
        requestId: requestIdFromHeaders(req),
        traceId: traceIdFromHeaders(req)
      };
      (req as unknown as Record<symbol, RequestState>)[requestState] = state;
      res.setHeader("x-request-id", state.requestId);
      res.setHeader("x-trace-id", state.traceId);

      const getResponseBody = this.config.captureResponseBody ? responseBodyCapture(res) : undefined;
      if (shouldIgnoreRoute(this.config, req)) {
        next();
        return;
      }

      res.on("finish", () => {
        const durationMs = Number(process.hrtime.bigint() - state.startedAt) / 1_000_000;
        const route = routeName(req);
        const labels = labelsForRequest(req, res, route);
        const timestamp = new Date().toISOString();
        const metadata: Record<string, unknown> = {
          route,
          method: req.method,
          statusCode: res.statusCode,
          durationMs,
          requestId: state.requestId,
          traceId: state.traceId,
          userAgent: req.get("user-agent"),
          ip: req.ip,
          projectKey: this.config.projectKey,
          serviceName: this.config.serviceName,
          environment: this.config.environment
        };

        if (this.config.captureHeaders) {
          metadata.requestHeaders = safeHeaders(req.headers as Record<string, unknown>);
          metadata.responseHeaders = safeHeaders(res.getHeaders());
        }
        if (this.config.captureRequestBody) {
          metadata.requestBody = req.body;
        }
        if (getResponseBody) {
          metadata.responseBody = getResponseBody();
        }

        const metrics: MetricInput[] = [
          { metricName: "http_requests_total", value: 1, labels, timestamp },
          { metricName: "http_request_duration_ms", value: durationMs, labels, timestamp }
        ];
        if (res.statusCode >= 400) {
          metrics.push({ metricName: "http_errors_total", value: 1, labels, timestamp });
        }
        if (res.statusCode >= 500) {
          metrics.push({ metricName: "http_5xx_total", value: 1, labels, timestamp });
        } else if (res.statusCode >= 400) {
          metrics.push({ metricName: "http_4xx_total", value: 1, labels, timestamp });
        }
        if (durationMs >= this.config.slowRequestThresholdMs) {
          metrics.push({ metricName: "slow_requests_total", value: 1, labels, timestamp });
        }

        void this.sendBatchMetrics(metrics);

        if (durationMs >= this.config.slowRequestThresholdMs) {
          void this.sendLog({
            level: "warn",
            message: `Slow request ${req.method} ${route}`,
            requestId: state.requestId,
            traceId: state.traceId,
            route,
            method: req.method,
            statusCode: res.statusCode,
            durationMs,
            timestamp,
            metadata
          });
        }

        if (res.statusCode >= 500) {
          void this.sendLog({
            level: "error",
            message: `HTTP ${res.statusCode} ${req.method} ${route}`,
            requestId: state.requestId,
            traceId: state.traceId,
            route,
            method: req.method,
            statusCode: res.statusCode,
            durationMs,
            timestamp,
            metadata
          });
        }
      });

      next();
    };
  }

  errorHandler(): ErrorRequestHandler {
    return (err: Error & { status?: number; statusCode?: number }, req: Request, res: Response, next: NextFunction) => {
      const route = routeName(req);
      const statusCode = err.statusCode ?? err.status ?? (res.statusCode >= 400 ? res.statusCode : 500);
      const state = (req as unknown as Record<symbol, RequestState>)[requestState];
      const requestId = state?.requestId ?? requestIdFromHeaders(req);
      const traceId = state?.traceId ?? traceIdFromHeaders(req);
      const durationMs = requestDurationMs(req);
      res.setHeader("x-request-id", requestId);
      res.setHeader("x-trace-id", traceId);

      const labels = { method: req.method, route, statusCode: String(statusCode) };
      void this.sendMetric({ metricName: "exceptions_total", value: 1, labels });
      void this.sendLog({
        level: "error",
        message: err.message,
        requestId,
        traceId,
        route,
        method: req.method,
        statusCode,
        durationMs,
        metadata: {
          name: err.name,
          message: err.message,
          stack: err.stack,
          route,
          method: req.method,
          statusCode,
          durationMs,
          requestId,
          traceId
        }
      });

      next(err);
    };
  }

  private async postJSON(path: string, payload: Record<string, unknown>) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
      try {
        const response = await fetch(`${this.config.apiUrl}${path}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        clearTimeout(timer);
        if (response.ok) return;
        throw new Error(`HTTP ${response.status}`);
      } catch (error) {
        clearTimeout(timer);
        if (attempt === 3) {
          debugWarn(this.config, `dropping telemetry after ${attempt} failed attempts to ${path}`, error);
          return;
        }
        await sleep(100 * 2 ** (attempt - 1));
      }
    }
  }
}

const singletonClients = new Map<string, AegisOpsClientImpl>();

const singletonKey = (config?: AegisOpsConfig) => {
  const normalized = normalizeConfig(config);
  return JSON.stringify({
    apiUrl: normalized.apiUrl,
    apiKey: normalized.apiKey,
    projectKey: normalized.projectKey,
    serviceName: normalized.serviceName,
    environment: normalized.environment,
    enabled: normalized.enabled,
    batchSize: normalized.batchSize,
    flushIntervalMs: normalized.flushIntervalMs,
    slowRequestThresholdMs: normalized.slowRequestThresholdMs,
    debug: normalized.debug
  });
};

const clientForConfig = (config?: AegisOpsConfig) => {
  const key = singletonKey(config);
  let client = singletonClients.get(key);
  if (!client) {
    client = new AegisOpsClientImpl(config);
    singletonClients.set(key, client);
  }
  return client;
};

export function createAegisOpsClient(config: AegisOpsConfig = {}): AegisOpsClient {
  return new AegisOpsClientImpl(config);
}

export async function sendLog(input: LogInput, config?: AegisOpsConfig) {
  await clientForConfig(config).sendLog(input);
}

export async function sendMetric(input: MetricInput, config?: AegisOpsConfig) {
  await clientForConfig(config).sendMetric(input);
}

export async function sendBatchMetrics(inputs: MetricInput[], config?: AegisOpsConfig) {
  await clientForConfig(config).sendBatchMetrics(inputs);
}

export function aegisopsMiddleware(config: AegisOpsConfig = {}): RequestHandler {
  return createAegisOpsClient(config).middleware();
}

export function aegisopsErrorHandler(config: AegisOpsConfig = {}): ErrorRequestHandler {
  return createAegisOpsClient(config).errorHandler();
}
