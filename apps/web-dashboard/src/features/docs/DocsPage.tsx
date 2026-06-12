import { BookOpen, Cable, Gauge, KeyRound, SearchCode, TerminalSquare } from "lucide-react";
import { CodeBlock } from "../../shared/ui/CodeBlock";

const docs = [
  ["Quickstart", "Create a workspace, connect a project, add a service, generate an API key, and send a test event."],
  ["Connect Project", "Use the guided app flow for project type, service setup, API key generation, SDK snippets, and verification."],
  ["Node.js Express SDK", "Install the Node SDK, add middleware, set env vars, and send request telemetry automatically."],
  ["Python FastAPI SDK", "Attach AegisOps middleware to FastAPI and send logs and metrics from routes."],
  ["Go HTTP SDK", "Wrap an http.ServeMux with AegisOps middleware and configure env variables."],
  ["Java Spring Boot SDK", "Register the servlet filter and use env configuration for API key, project key, and service name."],
  ["Generic HTTP ingestion", "Post logs and metrics directly to the gateway with a bearer API key."],
  ["Logs API", "Search by service, level, route, trace ID, request ID, status code, and time window."],
  ["Metrics API", "Send custom metrics, batch metrics, and inspect aggregates with p50, p95, and p99."],
  ["Alert Rules", "Create latency, error-rate, log-error, and service-health rules."],
  ["Troubleshooting", "Check API key, project key, service name, gateway URL, and connection status."]
];

export function DocsPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 max-w-3xl">
        <div className="mb-3 flex items-center gap-2 text-white">
          <BookOpen className="h-5 w-5" />
          <span className="text-sm font-semibold">Documentation</span>
        </div>
        <h1 className="text-4xl font-bold text-white">Connect, ingest, verify, and operate.</h1>
        <p className="mt-3 text-sm leading-6 text-text-soft">
          Start with the guided onboarding flow, then use these references when instrumenting a real app.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="grid gap-3">
          {docs.map(([title, description], index) => {
            const Icon = [Cable, TerminalSquare, Gauge, KeyRound, SearchCode][index % 5];
            return (
              <a
                key={title}
                href={title === "Connect Project" ? "/connect-project" : "/docs"}
                className="aegis-glass rounded-2xl p-4 hover:bg-white/10"
              >
                <div className="flex items-start gap-3">
                  <Icon className="mt-1 h-5 w-5 shrink-0 text-white" />
                  <div>
                    <p className="font-semibold text-white">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-text-soft">{description}</p>
                  </div>
                </div>
              </a>
            );
          })}
        </section>

        <section className="aegis-glass rounded-2xl p-4 shadow-panel">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-white">Generic HTTP example</h2>
            <p className="mt-1 text-sm text-text-soft">Works with any language that can send JSON over HTTP.</p>
          </div>
          <CodeBlock>{`export AEGISOPS_API_URL=http://localhost:8080
export AEGISOPS_API_KEY=aeg_live_xxx
export AEGISOPS_PROJECT_KEY=payments-api
export AEGISOPS_SERVICE_NAME=api-gateway

curl -X POST "$AEGISOPS_API_URL/ingest/logs" \\
  -H "Authorization: Bearer $AEGISOPS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "projectKey": "payments-api",
    "serviceName": "api-gateway",
    "environment": "production",
    "level": "info",
    "message": "checkout completed",
    "traceId": "trace_123"
  }'

curl -X POST "$AEGISOPS_API_URL/metrics-api/metrics/custom" \\
  -H "Authorization: Bearer $AEGISOPS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "projectKey": "payments-api",
    "serviceName": "api-gateway",
    "environment": "production",
    "metricName": "http_request_duration_ms",
    "value": 184
  }'`}</CodeBlock>
        </section>
      </div>
    </main>
  );
}
