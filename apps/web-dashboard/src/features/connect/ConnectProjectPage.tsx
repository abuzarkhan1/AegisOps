import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Cable,
  CheckCircle2,
  Clipboard,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  Send,
  Server,
  TerminalSquare,
  Trash2
} from "lucide-react";
import { coreApiUrl, gatewayUrl } from "../../app/config";
import {
  createApiKey,
  createProject,
  createService,
  fetchOrganizations,
  fetchServiceConnectionStatus,
  sendServiceTestEvent,
  type ProjectRecord,
  type ServiceConnectionStatus,
  type ServiceRecord
} from "../../shared/api/core";

type ProjectType = "monolith" | "microservices" | "worker-queue" | "frontend" | "hybrid";

type ServiceSetup = {
  name: string;
  serviceType: string;
  language: string;
};

const projectTypes: Array<{ value: ProjectType; label: string; description: string }> = [
  { value: "monolith", label: "Monolith", description: "One deployable app with logs, metrics, and request telemetry." },
  { value: "microservices", label: "Microservices", description: "Multiple independently deployed services in one project." },
  { value: "worker-queue", label: "Worker / Queue", description: "Background jobs, queues, schedulers, and async processors." },
  { value: "frontend", label: "Frontend", description: "Browser app telemetry, client logs, and user-facing route signals." },
  { value: "hybrid", label: "Hybrid", description: "A mix of APIs, frontends, workers, databases, caches, and brokers." }
];

const serviceTypes = ["api", "frontend", "worker", "database", "cache", "queue", "message-broker", "external-api"];
const languages = ["Node.js Express", "Node.js NestJS", "Python FastAPI", "Java Spring Boot", "Go HTTP", "React", "Generic HTTP"];
const steps = ["Project Type", "Project Details", "Service Setup", "API Key", "Install", "Test"];
const frameworkTabs = ["Node.js Express", "Python FastAPI", "Java Spring Boot", "Go HTTP", "Generic HTTP"];
const connectionStatusLabel = (status?: string) => {
  if (status === "connected") return "Service connected";
  if (status === "erroring") return "Receiving with errors";
  if (status === "stale") return "Telemetry stale";
  if (status === "not_connected") return "Not connected";
  return "Waiting for telemetry";
};

const defaultService = (projectType: ProjectType): ServiceSetup => ({
  name: projectType === "frontend" ? "web-frontend" : projectType === "worker-queue" ? "worker" : "web-app",
  serviceType: projectType === "frontend" ? "frontend" : projectType === "worker-queue" ? "worker" : "api",
  language: projectType === "frontend" ? "React" : projectType === "worker-queue" ? "Generic HTTP" : "Node.js Express"
});

const maskKey = (rawKey: string) => `${rawKey.slice(0, 10)}...${rawKey.slice(-4)}`;

type ConnectProjectPageProps = {
  onNavigate?: (label: string) => void;
};

export function ConnectProjectPage({ onNavigate }: ConnectProjectPageProps) {
  const [step, setStep] = useState(0);
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string }>>([]);
  const [projectType, setProjectType] = useState<ProjectType>("monolith");
  const [projectName, setProjectName] = useState("");
  const [projectKey, setProjectKey] = useState("");
  const [environment, setEnvironment] = useState("production");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [ownerTeam, setOwnerTeam] = useState("");
  const [services, setServices] = useState<ServiceSetup[]>([defaultService("monolith")]);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [createdServices, setCreatedServices] = useState<ServiceRecord[]>([]);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, ServiceConnectionStatus>>({});
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [frameworkTab, setFrameworkTab] = useState("Node.js Express");
  const [testStatus, setTestStatus] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    fetchOrganizations()
      .then((items) => setOrganizations(items.map((item) => ({ id: item.id, name: item.name }))))
      .catch(() => undefined);
  }, []);

  const selectedService = useMemo(
    () => createdServices.find((service) => service.id === selectedServiceId) ?? createdServices[0],
    [createdServices, selectedServiceId]
  );
  const selectedRawKey = selectedService ? apiKeys[selectedService.id] : undefined;
  const selectedStatus = selectedService ? statuses[selectedService.id] : undefined;
  const canCreate = projectName.trim() && services.every((service) => service.name.trim());

  useEffect(() => {
    if (!selectedService?.language) return;
    if (frameworkTabs.includes(selectedService.language)) {
      setFrameworkTab(selectedService.language === "Node.js NestJS" ? "Node.js Express" : selectedService.language);
    }
  }, [selectedService?.language]);

  function selectProjectType(nextType: ProjectType) {
    setProjectType(nextType);
    if (nextType === "monolith") {
      setServices([defaultService(nextType)]);
    } else if (services.length === 1 && services[0].name === "web-app") {
      setServices([defaultService(nextType), { name: "api", serviceType: "api", language: "Node.js Express" }]);
    }
  }

  function updateService(index: number, patch: Partial<ServiceSetup>) {
    setServices((current) => current.map((service, itemIndex) => (itemIndex === index ? { ...service, ...patch } : service)));
  }

  async function copyText(value: string, id: string) {
    await navigator.clipboard.writeText(value);
    setCopied(id);
    window.setTimeout(() => setCopied(""), 1500);
  }

  async function createProjectAndServices() {
    if (!canCreate || loading) return;
    setLoading(true);
    setError("");
    try {
      const organizationId = organizations[0]?.id;
      if (!organizationId) throw new Error("No organization is available for project creation.");

      const projectResult = await createProject({
        organizationId,
        name: projectName,
        projectKey,
        environment,
        projectType,
        repositoryUrl,
        ownerTeam
      });
      const created: ServiceRecord[] = [];
      for (const service of services) {
        const result = await createService(projectResult.project.id, {
          name: service.name,
          serviceType: service.serviceType,
          language: service.language,
          repositoryUrl,
          environment
        });
        created.push(result.service);
      }

      setProject(projectResult.project);
      setCreatedServices(created);
      setSelectedServiceId(created[0]?.id ?? "");
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create project.");
    } finally {
      setLoading(false);
    }
  }

  async function generateApiKeys() {
    if (createdServices.length === 0 || loading) return;
    setLoading(true);
    setError("");
    try {
      const nextKeys: Record<string, string> = {};
      for (const service of createdServices) {
        const result = await createApiKey(service.id, `${service.name} ingestion key`);
        nextKeys[service.id] = result.apiKey.rawKey;
      }
      setApiKeys(nextKeys);
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate API keys.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshStatuses() {
    const nextStatuses: Record<string, ServiceConnectionStatus> = {};
    for (const service of createdServices) {
      nextStatuses[service.id] = await fetchServiceConnectionStatus(service.id);
    }
    setStatuses(nextStatuses);
  }

  async function testSelectedService() {
    if (!selectedService || loading) return;
    setLoading(true);
    setError("");
    setTestStatus("sending");
    try {
      const result = await sendServiceTestEvent(selectedService.id);
      setStatuses((current) => ({ ...current, [selectedService.id]: result.connectionStatus }));
      await refreshStatuses();
      setStep(5);
      setTestStatus("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send test event.");
      setTestStatus("failed");
    } finally {
      setLoading(false);
    }
  }

  const nodeSnippet = selectedService && selectedRawKey
    ? `import express from "express";
import { aegisopsMiddleware, aegisopsErrorHandler } from "@aegisops/node";

const app = express();

app.use(
  aegisopsMiddleware({
    apiUrl: process.env.AEGISOPS_API_URL!,
    apiKey: process.env.AEGISOPS_API_KEY!,
    projectKey: process.env.AEGISOPS_PROJECT_KEY!,
    serviceName: process.env.AEGISOPS_SERVICE_NAME!,
    environment: process.env.AEGISOPS_ENVIRONMENT!,
    slowRequestThresholdMs: 1000,
  })
);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use(aegisopsErrorHandler());`
    : "";

  const pythonSnippet = `pip install -e packages/aegisops-python

from fastapi import FastAPI
from aegisops import add_aegisops_middleware

app = FastAPI()
add_aegisops_middleware(app)

@app.get("/health")
async def health():
    return {"ok": True}`;

  const javaSnippet = `<!-- Add packages/aegisops-java as a local Maven dependency/module -->

import com.aegisops.sdk.AegisOpsClient;
import com.aegisops.sdk.AegisOpsFilter;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
class AegisOpsTelemetryConfig {
  @Bean
  FilterRegistrationBean<AegisOpsFilter> aegisOpsFilter() {
    FilterRegistrationBean<AegisOpsFilter> bean =
        new FilterRegistrationBean<>(new AegisOpsFilter(AegisOpsClient.fromEnv()));
    bean.addUrlPatterns("/*");
    return bean;
  }
}`;

  const goSnippet = `go get github.com/aegisops/aegisops-go

package main

import (
  "net/http"
  aegisops "github.com/aegisops/aegisops-go"
)

func main() {
  client := aegisops.NewClientFromEnv()
  mux := http.NewServeMux()
  mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
    w.WriteHeader(http.StatusOK)
  })
  http.ListenAndServe(":7003", client.Middleware(mux))
}`;

  const envSnippet = selectedRawKey
    ? `AEGISOPS_ENABLED=true
AEGISOPS_API_URL=${gatewayUrl}
AEGISOPS_API_KEY=${selectedRawKey}
AEGISOPS_PROJECT_KEY=${project?.projectKey ?? projectKey}
AEGISOPS_SERVICE_NAME=${selectedService?.name ?? services[0]?.name}
AEGISOPS_ENVIRONMENT=${environment}`
    : "";

  const curlLog = selectedRawKey
    ? `curl -X POST ${gatewayUrl}/ingest/logs \\
  -H "Authorization: Bearer ${selectedRawKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"projectKey":"${project?.projectKey ?? projectKey}","serviceName":"${selectedService?.name}","environment":"${environment}","level":"info","message":"hello from AegisOps"}'`
    : "";

  const curlMetric = selectedRawKey
    ? `curl -X POST ${gatewayUrl}/metrics-api/metrics/custom \\
  -H "Authorization: Bearer ${selectedRawKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"projectKey":"${project?.projectKey ?? projectKey}","serviceName":"${selectedService?.name}","environment":"${environment}","metricName":"orders_total","value":1}'`
    : "";

  const curlBatchMetric = selectedRawKey
    ? `curl -X POST ${gatewayUrl}/metrics-api/metrics/batch \\
  -H "Authorization: Bearer ${selectedRawKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"projectKey":"${project?.projectKey ?? projectKey}","serviceName":"${selectedService?.name}","environment":"${environment}","metrics":[{"metricName":"http_requests_total","value":1,"labels":{"route":"/api/orders","method":"GET","statusCode":"200"}},{"metricName":"http_request_duration_ms","value":42.8,"labels":{"route":"/api/orders","method":"GET","statusCode":"200"}}]}'`
    : "";

  const frameworkSnippet = (() => {
    if (frameworkTab === "Node.js Express") {
      return [envSnippet, nodeSnippet].filter(Boolean).join("\n\n");
    }
    if (frameworkTab === "Python FastAPI") {
      return [envSnippet, pythonSnippet].filter(Boolean).join("\n\n");
    }
    if (frameworkTab === "Java Spring Boot") {
      return [envSnippet, javaSnippet].filter(Boolean).join("\n\n");
    }
    if (frameworkTab === "Go HTTP") {
      return [envSnippet, goSnippet].filter(Boolean).join("\n\n");
    }
    if (frameworkTab === "Generic HTTP") {
      return [curlLog, curlMetric, curlBatchMetric].filter(Boolean).join("\n\n");
    }
    return `${frameworkTab} SDK is coming next.

Use Generic HTTP today:

${[curlLog, curlMetric, curlBatchMetric].filter(Boolean).join("\n\n")}`;
  })();

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-col gap-3 border-b border-line pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-mint">
            <Cable className="h-4 w-4" aria-hidden="true" />
            <span>Connect Project</span>
          </div>
          <h2 className="text-2xl font-semibold text-white">Add a monitored project</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {steps.map((item, index) => (
            <button
              key={item}
              type="button"
              title={item}
              onClick={() => setStep(index)}
              className={`h-9 rounded-md border px-3 text-xs transition ${
                step === index ? "border-mint bg-mint/15 text-mint" : "border-line bg-[#0d1419] text-slate-300"
              }`}
            >
              {index + 1}. {item}
            </button>
          ))}
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#0d1419] md:basis-full">
          <div
            className="h-full rounded-full bg-mint transition-all"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {error ? <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}

      {step === 0 ? (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {projectTypes.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => selectProjectType(item.value)}
              className={`min-h-44 rounded-lg border p-4 text-left transition ${
                projectType === item.value ? "border-mint bg-mint/10" : "border-line bg-panel hover:border-slate-500"
              }`}
            >
              <Server className="mb-4 h-5 w-5 text-mint" aria-hidden="true" />
              <p className="text-base font-semibold text-white">{item.label}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
            </button>
          ))}
        </section>
      ) : null}

      {step === 1 ? (
        <section className="rounded-lg border border-line bg-panel p-4 shadow-panel">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-300">
              <span>Project name</span>
              <input className="w-full rounded-md border border-line bg-[#0d1419] px-3 py-2 text-white" value={projectName} onChange={(event) => setProjectName(event.target.value)} />
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span>Project key</span>
              <input className="w-full rounded-md border border-line bg-[#0d1419] px-3 py-2 text-white" value={projectKey} onChange={(event) => setProjectKey(event.target.value)} placeholder="payments-api" />
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span>Environment</span>
              <select className="w-full rounded-md border border-line bg-[#0d1419] px-3 py-2 text-white" value={environment} onChange={(event) => setEnvironment(event.target.value)}>
                <option value="development">development</option>
                <option value="staging">staging</option>
                <option value="production">production</option>
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span>Repository URL</span>
              <input className="w-full rounded-md border border-line bg-[#0d1419] px-3 py-2 text-white" value={repositoryUrl} onChange={(event) => setRepositoryUrl(event.target.value)} />
            </label>
            <label className="space-y-2 text-sm text-slate-300 md:col-span-2">
              <span>Owner team</span>
              <input className="w-full rounded-md border border-line bg-[#0d1419] px-3 py-2 text-white" value={ownerTeam} onChange={(event) => setOwnerTeam(event.target.value)} />
            </label>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="rounded-lg border border-line bg-panel p-4 shadow-panel">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-white">Services</h3>
            {projectType !== "monolith" ? (
              <button
                type="button"
                title="Add service"
                onClick={() => setServices((current) => [...current, { name: "", serviceType: "api", language: "Generic HTTP" }])}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-[#0d1419] px-3 text-sm text-white"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add
              </button>
            ) : null}
          </div>
          <div className="space-y-3">
            {services.map((service, index) => (
              <div key={index} className="grid gap-3 rounded-lg border border-line bg-[#0d1419] p-3 md:grid-cols-[1fr_180px_220px_42px]">
                <input className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-white" value={service.name} onChange={(event) => updateService(index, { name: event.target.value })} placeholder="service-name" />
                <select className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-white" value={service.serviceType} onChange={(event) => updateService(index, { serviceType: event.target.value })}>
                  {serviceTypes.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <select className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-white" value={service.language} onChange={(event) => updateService(index, { language: event.target.value })}>
                  {languages.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <button
                  type="button"
                  title="Remove service"
                  disabled={services.length === 1}
                  onClick={() => setServices((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  className="grid h-10 w-10 place-items-center rounded-md border border-line text-slate-300 disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="rounded-lg border border-line bg-panel p-4 shadow-panel">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-white">API keys</h3>
              <p className="mt-1 text-sm text-slate-400">{project ? project.name : "Create the project before generating keys."}</p>
            </div>
            <button
              type="button"
              title="Generate API keys"
              onClick={generateApiKeys}
              disabled={createdServices.length === 0 || loading}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-mint px-4 text-sm font-semibold text-slate-950 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Clipboard className="h-4 w-4" aria-hidden="true" />}
              Generate
            </button>
          </div>
          <div className="space-y-2">
            {createdServices.map((service) => (
              <div key={service.id} className="flex flex-col gap-2 rounded-lg border border-line bg-[#0d1419] p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-white">{service.name}</p>
                  <p className="text-xs text-slate-400">{service.serviceType} / {service.language ?? "Generic HTTP"}</p>
                </div>
                <button
                  type="button"
                  title="Copy API key"
                  disabled={!apiKeys[service.id]}
                  onClick={() => copyText(apiKeys[service.id], service.id)}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-line px-3 text-sm text-slate-200 disabled:opacity-50"
                >
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  {apiKeys[service.id] ? copied === service.id ? "Copied" : maskKey(apiKeys[service.id]) : "Waiting"}
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {step === 4 ? (
        <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-lg border border-line bg-panel p-4 shadow-panel">
            <h3 className="mb-3 text-base font-semibold text-white">Service</h3>
            <select className="w-full rounded-md border border-line bg-[#0d1419] px-3 py-2 text-white" value={selectedServiceId} onChange={(event) => setSelectedServiceId(event.target.value)}>
              {createdServices.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
            </select>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <p>Core API: <span className="text-slate-100">{coreApiUrl}</span></p>
              <p>Gateway: <span className="text-slate-100">{gatewayUrl}</span></p>
              <p>Project key: <span className="text-slate-100">{project?.projectKey ?? projectKey}</span></p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                title="Copy API key"
                disabled={!selectedRawKey}
                onClick={() => selectedRawKey ? copyText(selectedRawKey, "selected-api-key") : undefined}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-[#0d1419] px-3 text-sm text-slate-200 disabled:opacity-50"
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
                {copied === "selected-api-key" ? "Copied" : "API Key"}
              </button>
              <button
                type="button"
                title="Copy environment config"
                disabled={!envSnippet}
                onClick={() => copyText(envSnippet, "env-config")}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-[#0d1419] px-3 text-sm text-slate-200 disabled:opacity-50"
              >
                <Clipboard className="h-4 w-4" aria-hidden="true" />
                {copied === "env-config" ? "Copied" : "Env Config"}
              </button>
            </div>
          </div>
          <div className="rounded-lg border border-line bg-panel p-4 shadow-panel">
            <div className="mb-3 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <TerminalSquare className="h-5 w-5 text-mint" aria-hidden="true" />
                <h3 className="text-base font-semibold text-white">Framework instructions</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {frameworkTabs.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setFrameworkTab(item)}
                    className={`h-9 rounded-md border px-3 text-xs transition ${
                      frameworkTab === item ? "border-mint bg-mint/15 text-mint" : "border-line bg-[#0d1419] text-slate-300"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-end">
                <button
                  type="button"
                  title="Copy install instructions"
                  disabled={!frameworkSnippet}
                  onClick={() => copyText(frameworkSnippet, "framework-snippet")}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-[#0d1419] px-3 text-sm text-slate-200 disabled:opacity-50"
                >
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  {copied === "framework-snippet" ? "Copied" : "Instructions"}
                </button>
              </div>
              {frameworkTab === "Node.js Express" ? (
                <>
                  <pre className="overflow-auto rounded-lg border border-line bg-[#0d1419] p-3 text-xs leading-5 text-slate-200">{envSnippet}</pre>
                  <pre className="overflow-auto rounded-lg border border-line bg-[#0d1419] p-3 text-xs leading-5 text-slate-200">{nodeSnippet}</pre>
                </>
              ) : (
                <pre className="overflow-auto rounded-lg border border-line bg-[#0d1419] p-3 text-xs leading-5 text-slate-200">{frameworkSnippet}</pre>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {step === 5 ? (
        <section className="rounded-lg border border-line bg-panel p-4 shadow-panel">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-white">Connection test</h3>
              <p className="mt-1 text-sm text-slate-400">{selectedService ? selectedService.name : "Select a service"} / {project?.name}</p>
              <p className="mt-1 text-xs text-slate-500">
                {testStatus === "sending" ? "Sending test event..." : testStatus === "sent" ? "Test event accepted" : testStatus === "failed" ? "Test event failed" : "Send a test event or ingest real telemetry from your app."}
              </p>
            </div>
            <button
              type="button"
              title="Send test event"
              onClick={testSelectedService}
              disabled={!selectedService || loading}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-mint px-4 text-sm font-semibold text-slate-950 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
              Send Test Event
            </button>
          </div>
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-line bg-[#0d1419] p-3">
              <p className="text-xs text-slate-400">Status</p>
              <p className="mt-1 text-sm font-semibold text-white">{connectionStatusLabel(selectedStatus?.status)}</p>
            </div>
            <div className="rounded-lg border border-line bg-[#0d1419] p-3">
              <p className="text-xs text-slate-400">Logs 15m</p>
              <p className="mt-1 text-sm font-semibold text-white">{selectedStatus?.logsLast15m ?? 0}</p>
            </div>
            <div className="rounded-lg border border-line bg-[#0d1419] p-3">
              <p className="text-xs text-slate-400">Metrics 15m</p>
              <p className="mt-1 text-sm font-semibold text-white">{selectedStatus?.metricsLast15m ?? 0}</p>
            </div>
            <div className="rounded-lg border border-line bg-[#0d1419] p-3">
              <p className="text-xs text-slate-400">P95 latency</p>
              <p className="mt-1 text-sm font-semibold text-white">{Math.round(selectedStatus?.p95LatencyLast15m ?? 0)} ms</p>
            </div>
          </div>
          {selectedStatus?.connected ? (
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                title="Open project dashboard"
                onClick={() => onNavigate?.("Projects")}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-mint px-4 text-sm font-semibold text-slate-950"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Open Project Dashboard
              </button>
              <button
                type="button"
                title="View logs"
                onClick={() => onNavigate?.("Logs")}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-line bg-[#0d1419] px-4 text-sm text-slate-200"
              >
                <FileText className="h-4 w-4" aria-hidden="true" />
                View Logs
              </button>
              <button
                type="button"
                title="View metrics"
                onClick={() => onNavigate?.("Metrics")}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-line bg-[#0d1419] px-4 text-sm text-slate-200"
              >
                <BarChart3 className="h-4 w-4" aria-hidden="true" />
                View Metrics
              </button>
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            {createdServices.map((service) => {
              const status = statuses[service.id];
              return (
                <div key={service.id} className="rounded-lg border border-line bg-[#0d1419] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-white">{service.name}</p>
                    <span className={`inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs ${status?.connected ? "bg-mint/15 text-mint" : "bg-slate-800 text-slate-300"}`}>
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {connectionStatusLabel(status?.status)}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-3">
                    <p>Last log<br /><span className="text-slate-200">{status?.lastLogAt ? new Date(status.lastLogAt).toLocaleString() : "Waiting"}</span></p>
                    <p>Last metric<br /><span className="text-slate-200">{status?.lastMetricAt ? new Date(status.lastMetricAt).toLocaleString() : "Waiting"}</span></p>
                    <p>Heartbeat<br /><span className="text-slate-200">{status?.lastHeartbeatAt ? new Date(status.lastHeartbeatAt).toLocaleString() : "Waiting"}</span></p>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-3">
                    <p>Logs health<br /><span className="text-slate-200">{status?.telemetryHealth?.logs ?? "waiting"}</span></p>
                    <p>Metrics health<br /><span className="text-slate-200">{status?.telemetryHealth?.metrics ?? "waiting"}</span></p>
                    <p>Error rate<br /><span className="text-slate-200">{status?.errorRateLast15m ?? 0}%</span></p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap justify-between gap-3 border-t border-line pt-4">
        <button
          type="button"
          title="Previous step"
          onClick={() => setStep((current) => Math.max(0, current - 1))}
          className="h-10 rounded-md border border-line bg-[#0d1419] px-4 text-sm text-slate-200"
        >
          Back
        </button>
        {step < 2 ? (
          <button type="button" title="Next step" onClick={() => setStep((current) => current + 1)} className="inline-flex h-10 items-center gap-2 rounded-md bg-mint px-4 text-sm font-semibold text-slate-950">
            Next <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : step === 2 ? (
          <button type="button" title="Create project" onClick={createProjectAndServices} disabled={!canCreate || loading} className="inline-flex h-10 items-center gap-2 rounded-md bg-mint px-4 text-sm font-semibold text-slate-950 disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
            Create Project
          </button>
        ) : step === 3 ? (
          <button type="button" title="Install step" onClick={() => setStep(4)} disabled={Object.keys(apiKeys).length === 0} className="inline-flex h-10 items-center gap-2 rounded-md bg-mint px-4 text-sm font-semibold text-slate-950 disabled:opacity-60">
            Install <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : step === 4 ? (
          <button type="button" title="Test step" onClick={() => setStep(5)} className="inline-flex h-10 items-center gap-2 rounded-md bg-mint px-4 text-sm font-semibold text-slate-950">
            Test <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <button type="button" title="Refresh status" onClick={refreshStatuses} className="inline-flex h-10 items-center gap-2 rounded-md border border-line bg-[#0d1419] px-4 text-sm text-slate-200">
            Refresh Status
          </button>
        )}
      </div>
    </div>
  );
}
