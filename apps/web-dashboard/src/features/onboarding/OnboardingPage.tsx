import {
  ArrowRight,
  CheckCircle2,
  Clipboard,
  Gauge,
  KeyRound,
  Loader2,
  Plus,
  RadioTower,
  Send,
  Server,
  Sparkles,
  Trash2
} from "lucide-react";
import { useMemo, useState } from "react";
import { gatewayUrl } from "../../app/config";
import {
  createAlertRule,
  createApiKey,
  createProject,
  createService,
  fetchOrganizations,
  fetchServiceConnectionStatus,
  sendServiceTestEvent,
  updateOrganization,
  type ProjectRecord,
  type ServiceConnectionStatus,
  type ServiceRecord
} from "../../shared/api/core";
import { Button } from "../../shared/ui/Button";
import { CodeBlock } from "../../shared/ui/CodeBlock";
import { CopyButton } from "../../shared/ui/CopyButton";
import { Input, Select } from "../../shared/ui/FormControls";
import { Stepper } from "../../shared/ui/Progress";

type ProjectType = "monolith" | "microservices" | "worker-queue" | "frontend";
type ServiceDraft = { name: string; serviceType: string; language: string };

const monitorOptions: Array<{ value: ProjectType; label: string; description: string }> = [
  { value: "monolith", label: "A monolith backend", description: "One app, one service, one fast path to telemetry." },
  { value: "microservices", label: "A microservices system", description: "Multiple services under one project." },
  { value: "worker-queue", label: "A worker/queue service", description: "Jobs, queues, schedulers, and async processors." },
  { value: "frontend", label: "A frontend app", description: "Client-facing app telemetry and browser-side events." }
];

const integrationMethods = ["Node.js Express", "Python FastAPI", "Go HTTP", "Java Spring Boot", "Generic HTTP"];
const steps = ["Welcome", "Workspace", "Project", "Service", "Integration", "API Key", "Verify", "Success"];

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const defaultService = (type: ProjectType): ServiceDraft => ({
  name:
    type === "frontend" ? "web-frontend" : type === "worker-queue" ? "jobs-worker" : type === "microservices" ? "api-gateway" : "web-app",
  serviceType: type === "frontend" ? "frontend" : type === "worker-queue" ? "worker" : "api",
  language: type === "frontend" ? "Generic HTTP" : "Node.js Express"
});

const recommendedRules = [
  { name: "Error rate > 5% for 5 minutes", metric: "error_rate", operator: "gt", threshold: 5, durationSeconds: 300, severity: "high" },
  {
    name: "P95 latency > 2000ms for 10 minutes",
    metric: "p95LatencyMs",
    operator: "gt",
    threshold: 2000,
    durationSeconds: 600,
    severity: "high"
  },
  { name: "5xx errors > 20 in 5 minutes", metric: "log_error", operator: "gt", threshold: 20, durationSeconds: 300, severity: "medium" },
  {
    name: "No telemetry received for 15 minutes",
    metric: "service_health",
    operator: "eq",
    threshold: 0,
    durationSeconds: 900,
    severity: "medium"
  }
];

export function OnboardingPage({ onNavigate }: { onNavigate?: (label: string) => void }) {
  const [step, setStep] = useState(0);
  const [projectType, setProjectType] = useState<ProjectType>("monolith");
  const [workspaceName, setWorkspaceName] = useState("");
  const [teamSize, setTeamSize] = useState("Solo developer");
  const [role, setRole] = useState("Backend team");
  const [projectName, setProjectName] = useState("Payments API");
  const [projectKey, setProjectKey] = useState("payments-api");
  const [environment, setEnvironment] = useState("production");
  const [services, setServices] = useState<ServiceDraft[]>([defaultService("monolith")]);
  const [integration, setIntegration] = useState("Node.js Express");
  const [createdProject, setCreatedProject] = useState<ProjectRecord>();
  const [createdServices, setCreatedServices] = useState<ServiceRecord[]>([]);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<ServiceConnectionStatus>();
  const [loading, setLoading] = useState(false);

  const selectedService = createdServices[0];
  const selectedApiKey = selectedService ? apiKeys[selectedService.id] : undefined;
  const canCreateProject = projectName.trim() && projectKey.trim() && services.every((service) => service.name.trim());

  const envSnippet = useMemo(() => {
    if (!selectedApiKey || !createdProject || !selectedService) return "";
    return `AEGISOPS_API_URL=${gatewayUrl}
AEGISOPS_API_KEY=${selectedApiKey}
AEGISOPS_PROJECT_KEY=${createdProject.projectKey}
AEGISOPS_SERVICE_NAME=${selectedService.name}
AEGISOPS_ENVIRONMENT=${environment}`;
  }, [createdProject, environment, selectedApiKey, selectedService]);

  const installSnippet = useMemo(() => {
    if (!createdProject || !selectedService || !selectedApiKey) return "";
    const generic = `curl -X POST ${gatewayUrl}/ingest/logs \\
  -H "Authorization: Bearer ${selectedApiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"projectKey":"${createdProject.projectKey}","serviceName":"${selectedService.name}","environment":"${environment}","level":"info","message":"hello from AegisOps"}'`;
    if (integration === "Python FastAPI")
      return `${envSnippet}\n\nfrom fastapi import FastAPI\nfrom aegisops import add_aegisops_middleware\n\napp = FastAPI()\nadd_aegisops_middleware(app)`;
    if (integration === "Go HTTP")
      return `${envSnippet}\n\nclient := aegisops.NewClientFromEnv()\nhttp.ListenAndServe(":8080", client.Middleware(mux))`;
    if (integration === "Java Spring Boot")
      return `${envSnippet}\n\n@Bean\nFilterRegistrationBean<AegisOpsFilter> aegisOpsFilter() {\n  return new FilterRegistrationBean<>(new AegisOpsFilter(AegisOpsClient.fromEnv()));\n}`;
    if (integration === "Generic HTTP") return `${envSnippet}\n\n${generic}`;
    return `${envSnippet}\n\napp.use(aegisopsMiddleware({\n  apiUrl: process.env.AEGISOPS_API_URL,\n  apiKey: process.env.AEGISOPS_API_KEY,\n  projectKey: process.env.AEGISOPS_PROJECT_KEY,\n  serviceName: process.env.AEGISOPS_SERVICE_NAME,\n  environment: process.env.AEGISOPS_ENVIRONMENT\n}));`;
  }, [createdProject, envSnippet, environment, integration, selectedApiKey, selectedService]);

  function chooseProjectType(value: ProjectType) {
    setProjectType(value);
    setServices(
      value === "microservices"
        ? [defaultService(value), { name: "payment-service", serviceType: "api", language: "Go HTTP" }]
        : [defaultService(value)]
    );
  }

  function updateService(index: number, patch: Partial<ServiceDraft>) {
    setServices((current) => current.map((service, itemIndex) => (itemIndex === index ? { ...service, ...patch } : service)));
  }

  async function createProjectAndServices() {
    if (!canCreateProject || loading) return;
    setLoading(true);
    setStatus("Creating project and services");
    try {
      const orgs = await fetchOrganizations();
      const organizationId = orgs[0]?.id;
      if (!organizationId) throw new Error("No workspace found for your user.");
      if (workspaceName.trim()) {
        await updateOrganization(organizationId, { name: workspaceName.trim() });
      }
      const projectResult = await createProject({
        organizationId,
        name: projectName,
        projectKey,
        environment,
        projectType,
        description: `Created from onboarding for ${teamSize} / ${role}`,
        ownerTeam: role
      });
      const nextServices: ServiceRecord[] = [];
      for (const service of services) {
        nextServices.push((await createService(projectResult.project.id, { ...service, environment })).service);
      }
      setCreatedProject(projectResult.project);
      setCreatedServices(nextServices);
      setStep(5);
      setStatus("Project and services created");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to create project");
    } finally {
      setLoading(false);
    }
  }

  async function generateKeys() {
    if (createdServices.length === 0 || loading) return;
    setLoading(true);
    setStatus("Generating API key");
    try {
      const keys: Record<string, string> = {};
      for (const service of createdServices) {
        keys[service.id] = (await createApiKey(service.id, `${service.name} onboarding key`)).apiKey.rawKey;
      }
      setApiKeys(keys);
      setStatus("API key generated");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to generate API key");
    } finally {
      setLoading(false);
    }
  }

  async function verifyTelemetry() {
    if (!selectedService || loading) return;
    setLoading(true);
    setStatus("Sending test event");
    try {
      await sendServiceTestEvent(selectedService.id);
      const nextStatus = await fetchServiceConnectionStatus(selectedService.id);
      setConnectionStatus(nextStatus);
      setStep(7);
      setStatus("Telemetry verification started");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to verify telemetry");
    } finally {
      setLoading(false);
    }
  }

  async function applyRecommendedRules() {
    if (!createdProject || !selectedService || loading) return;
    setLoading(true);
    setStatus("Creating recommended alert rules");
    try {
      for (const rule of recommendedRules) {
        await createAlertRule({
          organizationId: createdProject.organizationId,
          serviceId: selectedService.id,
          ...rule,
          enabled: true
        });
      }
      setStatus("Recommended alert rules created");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to create recommended alert rules");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="aegis-glass rounded-2xl p-5 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-white">
              <RadioTower className="h-5 w-5" />
              <span className="text-sm font-semibold">Guided onboarding</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Let's connect your first project.</h1>
            <p className="mt-1 text-sm text-text-soft">AegisOps helps you monitor any project from one dashboard.</p>
          </div>
          <div className="w-full max-w-3xl lg:w-[58%]">
            <Stepper steps={steps} activeIndex={step} onStepChange={setStep} />
          </div>
        </div>
      </section>

      {status ? <div className="aegis-glass rounded-2xl p-3 text-sm text-text-soft">{status}</div> : null}

      {step === 0 ? (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {monitorOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => chooseProjectType(option.value)}
              className={`min-h-44 rounded-2xl border p-4 text-left transition ${
                option.value === projectType ? "border-white/40 bg-white/10" : "border-white/10 bg-white/5 hover:border-white/30"
              }`}
            >
              <Server className="mb-4 h-5 w-5 text-white" />
              <p className="font-semibold text-white">{option.label}</p>
              <p className="mt-2 text-sm leading-6 text-text-soft">{option.description}</p>
            </button>
          ))}
        </section>
      ) : null}

      {step === 1 ? (
        <section className="aegis-glass rounded-2xl p-5 shadow-panel">
          <div className="grid gap-4 md:grid-cols-3">
            <Input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="Workspace name" />
            <Select value={teamSize} onChange={(event) => setTeamSize(event.target.value)} aria-label="Team size">
              {["Solo developer", "Startup team", "DevOps/SRE team", "Backend team"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </Select>
            <Select value={role} onChange={(event) => setRole(event.target.value)} aria-label="Role">
              {["Backend team", "DevOps/SRE team", "Founder", "Product engineering", "Platform team"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </Select>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="aegis-glass rounded-2xl p-5 shadow-panel">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              value={projectName}
              onChange={(event) => {
                setProjectName(event.target.value);
                setProjectKey(slugify(event.target.value));
              }}
              placeholder="Project name"
            />
            <Input value={projectKey} onChange={(event) => setProjectKey(slugify(event.target.value))} placeholder="project-key" />
            <Select
              value={projectType}
              onChange={(event) => chooseProjectType(event.target.value as ProjectType)}
              aria-label="Project type"
            >
              <option value="monolith">monolith</option>
              <option value="microservices">microservices</option>
              <option value="worker-queue">worker-queue</option>
              <option value="frontend">frontend</option>
            </Select>
            <Select value={environment} onChange={(event) => setEnvironment(event.target.value)} aria-label="Environment">
              <option value="production">production</option>
              <option value="staging">staging</option>
              <option value="development">development</option>
            </Select>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="aegis-glass rounded-2xl p-5 shadow-panel">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Services</h2>
            {projectType === "microservices" ? (
              <Button
                size="sm"
                icon={<Plus className="h-4 w-4" />}
                onClick={() => setServices((current) => [...current, { name: "", serviceType: "api", language: "Generic HTTP" }])}
              >
                Add service
              </Button>
            ) : null}
          </div>
          <div className="grid gap-3">
            {services.map((service, index) => (
              <div key={index} className="grid gap-3 aegis-glass rounded-2xl p-3 md:grid-cols-[1fr_170px_190px_42px]">
                <Input
                  value={service.name}
                  onChange={(event) => updateService(index, { name: event.target.value })}
                  placeholder="service-name"
                />
                <Select
                  value={service.serviceType}
                  onChange={(event) => updateService(index, { serviceType: event.target.value })}
                  aria-label="Service type"
                >
                  {["api", "frontend", "worker", "database", "cache", "queue"].map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </Select>
                <Select
                  value={service.language}
                  onChange={(event) => updateService(index, { language: event.target.value })}
                  aria-label="Language"
                >
                  {["Node.js Express", "Python FastAPI", "Go HTTP", "Java Spring Boot", "Generic HTTP"].map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </Select>
                <button
                  type="button"
                  disabled={services.length === 1}
                  onClick={() => setServices((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-text-soft disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {step === 4 ? (
        <section className="grid gap-3 md:grid-cols-3">
          {integrationMethods.map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => setIntegration(method)}
              className={`rounded-2xl border p-4 text-left transition ${
                integration === method ? "border-white/40 bg-white/10" : "border-white/10 bg-white/5 hover:border-white/30"
              }`}
            >
              <Sparkles className="mb-4 h-5 w-5 text-white" />
              <p className="font-semibold text-white">{method}</p>
              <p className="mt-2 text-sm leading-6 text-text-soft">Show install commands, env vars, and verification steps.</p>
            </button>
          ))}
        </section>
      ) : null}

      {step === 5 ? (
        <section className="aegis-glass rounded-2xl p-5 shadow-panel">
          {selectedApiKey ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-white">API key and install instructions</h2>
                  <p className="text-sm text-text-soft">
                    {selectedService?.name} / {integration}
                  </p>
                </div>
                <CopyButton value={installSnippet} label="Copy setup" />
              </div>
              <CodeBlock>{installSnippet}</CodeBlock>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">Generate API key</h2>
                <p className="mt-1 text-sm text-text-soft">A one-time key is shown after creation. Store it in your app environment.</p>
              </div>
              <Button
                variant="primary"
                disabled={loading || createdServices.length === 0}
                icon={loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                onClick={generateKeys}
              >
                Generate API key
              </Button>
            </div>
          )}
        </section>
      ) : null}

      {step === 6 ? (
        <section className="aegis-glass rounded-2xl p-5 shadow-panel">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Verify telemetry</h2>
              <p className="mt-1 text-sm text-text-soft">Send a backend-backed test event or install the SDK in your real service.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                disabled={loading || !selectedService}
                icon={loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                onClick={verifyTelemetry}
              >
                Send test event
              </Button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ["Waiting for first log", connectionStatus?.lastLogAt],
              ["Waiting for first metric", connectionStatus?.lastMetricAt],
              ["Checking service connection", connectionStatus?.connected],
              ["Preparing dashboard", connectionStatus?.status]
            ].map(([label, done]) => (
              <div key={String(label)} className="aegis-glass rounded-2xl p-4">
                <CheckCircle2 className={`mb-3 h-5 w-5 ${done ? "text-white" : "text-text-muted/70"}`} />
                <p className="text-sm font-semibold text-white">{label}</p>
                <p className="mt-1 text-xs text-text-muted">{done ? "Ready" : "Pending"}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {step === 7 ? (
        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-panel">
          <CheckCircle2 className="mb-4 h-8 w-8 text-white" />
          <h2 className="text-2xl font-bold text-white">Your service is connected.</h2>
          <p className="mt-2 text-sm text-text-soft">
            AegisOps is ready to show telemetry, logs, metrics, alerts, incidents, and RCA from your workspace.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="primary" icon={<Gauge className="h-4 w-4" />} onClick={() => onNavigate?.("Overview")}>
              Open dashboard
            </Button>
            <Button onClick={() => onNavigate?.("Logs")}>View logs</Button>
            <Button onClick={() => onNavigate?.("Metrics")}>View metrics</Button>
            <Button icon={<Clipboard className="h-4 w-4" />} onClick={applyRecommendedRules}>
              Create alert rules
            </Button>
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap justify-between gap-3 border-t border-white/10 pt-4">
        <Button disabled={step === 0 || loading} onClick={() => setStep((current) => Math.max(0, current - 1))}>
          Back
        </Button>
        <div className="flex flex-wrap gap-2">
          {step < 4 ? (
            <Button
              variant="primary"
              disabled={loading}
              icon={<ArrowRight className="h-4 w-4" />}
              onClick={() => setStep((current) => current + 1)}
            >
              Next
            </Button>
          ) : step === 4 ? (
            <Button
              variant="primary"
              disabled={loading || !canCreateProject}
              icon={loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              onClick={createProjectAndServices}
            >
              Create project
            </Button>
          ) : step === 5 && selectedApiKey ? (
            <Button variant="primary" icon={<ArrowRight className="h-4 w-4" />} onClick={() => setStep(6)}>
              Verify
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
