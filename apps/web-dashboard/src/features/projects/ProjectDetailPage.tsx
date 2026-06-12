import { useEffect, useState, useMemo } from "react";
import {
  ArrowLeft,
  Server,
  Activity,
  Siren,
  GitBranch,
  Wand2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Logs,
  TrendingUp,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Cable,
  Copy,
  Send
} from "lucide-react";
import {
  createApiKey,
  fetchServices,
  fetchIncidents,
  fetchDeployments,
  fetchLogs,
  fetchAlertRules,
  fetchRoutePerformance,
  fetchMetricAggregates,
  fetchProjectDetailSummary,
  sendServiceTestEvent,
  type ProjectRecord,
  type ServiceRecord,
  type IncidentRecord,
  type DeploymentRecord,
  type AlertRuleRecord,
  type MetricAggregateRecord,
  type ProjectDetailSummary,
  type ServiceConnectionStatus
} from "../../shared/api/core";

type ProjectDetailPageProps = {
  project: ProjectRecord;
  onBack: () => void;
  onSelectService: (serviceId: string) => void;
};

const emptySummary: ProjectDetailSummary = {
  servicesCount: 0,
  healthyServices: 0,
  degradedServices: 0,
  downServices: 0,
  activeIncidents: 0,
  logsIngested: 0,
  metricsIngested: 0,
  totalThroughput: 0,
  latencySamples: 0,
  requestsPerSecond: 0,
  errorRate: 0,
  p50LatencyMs: 0,
  p95LatencyMs: 0,
  p99LatencyMs: 0,
  uptimePercent: 0
};

const timeRangeToFrom = (range: string) => {
  const hours = range === "1h" ? 1 : range === "7d" ? 24 * 7 : 24;
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
};

const numberFmt = (value: number, digits = 1) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(Number.isFinite(value) ? value : 0);
const connectionStatusLabel = (status?: string) => {
  if (status === "connected") return "Service connected";
  if (status === "log_received") return "Log received";
  if (status === "metric_received") return "Metric received";
  return "Waiting for telemetry";
};

export function ProjectDetailPage({ project, onBack, onSelectService }: ProjectDetailPageProps) {
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRuleRecord[]>([]);
  const [routePerformance, setRoutePerformance] = useState<any[]>([]);
  const [summary, setSummary] = useState<ProjectDetailSummary>(emptySummary);
  const [latencyAggregates, setLatencyAggregates] = useState<MetricAggregateRecord[]>([]);

  const [environment, setEnvironment] = useState("production");
  const [timeRange, setTimeRange] = useState("24h");
  const [loading, setLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const [generatingAi, setGeneratingAi] = useState(false);
  const [setupApiKey, setSetupApiKey] = useState("");
  const [setupStatus, setSetupStatus] = useState<ServiceConnectionStatus | null>(null);
  const [setupLoading, setSetupLoading] = useState("");

  const allProjectServices = services.filter((s) => s.projectId === project.id);
  const projectServices = services.filter((s) => s.projectId === project.id && s.environment?.toLowerCase() === environment.toLowerCase());
  const setupService = projectServices[0] ?? allProjectServices[0];

  const projectType = useMemo(() => {
    if (projectServices.length <= 1) return "Monolith";
    if (projectServices.length <= 4) return "Microservices";
    return "Hybrid Microservices";
  }, [projectServices]);

  const activeIncidents = incidents.filter((inc) => inc.status !== "resolved");

  async function loadData() {
    setLoading(true);
    try {
      const from = timeRangeToFrom(timeRange);
      const [allServices, allIncidents, allDeployments, allLogs, allRules, performance, detailSummary, aggregates] = await Promise.all([
        fetchServices(),
        fetchIncidents(),
        fetchDeployments(),
        fetchLogs({ projectId: project.id, environment, from, limit: 15 }),
        fetchAlertRules(),
        fetchRoutePerformance(project.id, undefined, { environment, from }),
        fetchProjectDetailSummary(project.id, { environment, from }),
        fetchMetricAggregates({
          projectId: project.id,
          environment,
          metricName: "http_request_duration_ms",
          window: "1m",
          from,
          limit: 60
        })
      ]);

      setServices(allServices);
      setIncidents(allIncidents.filter((inc: any) => inc.projectId === project.id));
      setDeployments(allDeployments.filter((d: any) => d.projectId === project.id || d.environment === environment));
      setLogs(allLogs);
      setAlertRules(allRules.filter((r) => r.serviceId && allServices.some((s) => s.id === r.serviceId && s.projectId === project.id)));
      setRoutePerformance(performance || []);
      setSummary({ ...emptySummary, ...detailSummary });
      setLatencyAggregates(aggregates || []);
    } catch {
      setSummary(emptySummary);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [project.id, environment, timeRange]);

  const generateAiSummary = () => {
    setGeneratingAi(true);
    setAiSummary("");
    setTimeout(() => {
      const healthyServices = projectServices.filter((s) => s.healthStatus === "healthy" || s.healthStatus === "ok").length;
      const totalServices = projectServices.length;
      const issues = activeIncidents.length;

      let report = `### AegisOps AI Project Health Analysis\n\n`;
      report += `**Overall Status**: ${issues > 0 ? "Degraded" : "Optimal"} health across all microservices.\n\n`;
      report += `* **Services Operational**: ${healthyServices} of ${totalServices} active components are fully operational.\n`;
      report += `* **Current Incidents**: ${issues} open alert events require engineering review.\n`;
      report += `* **Uptime Rating**: ${numberFmt(summary.uptimePercent, 2)}% system availability in the last ${timeRange}.\n\n`;
      report += `#### Key Observations\n`;
      if (issues > 0) {
        report += `1. **Active Incident Pressure**: ${issues} open incident${issues === 1 ? "" : "s"} exist for this project.\n`;
        report += `2. **Latency Snapshot**: Current p95 is ${numberFmt(summary.p95LatencyMs, 0)} ms with ${numberFmt(summary.logsIngested, 0)} logs in the selected window.\n`;
      } else {
        report += `1. **Steady State**: ${numberFmt(summary.requestsPerSecond, 2)} req/s with ${numberFmt(summary.errorRate, 2)}% error rate in the selected window.\n`;
        report += `2. **Telemetry Coverage**: ${numberFmt(summary.metricsIngested, 0)} metrics and ${numberFmt(summary.logsIngested, 0)} logs are available for analysis.\n`;
      }
      report += `\n#### Recommended Actions\n`;
      report += `* [ ] Review top slow routes in the route-performance table\n`;
      report += `* [ ] Check active incidents before the next deployment\n`;
      report += `* [ ] Verify alert thresholds for services with degraded health`;

      setAiSummary(report);
      setGeneratingAi(false);
    }, 1200);
  };

  const trendData = useMemo(() => {
    const latencyRows = [...latencyAggregates].reverse().slice(-12);
    if (latencyRows.length > 0) {
      return latencyRows.map((row) => ({
        label: new Date(row.timestampBucket).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        throughput: row.count,
        latency: Math.round(row.p95),
        errorRate: summary.errorRate
      }));
    }
    return routePerformance.slice(0, 12).map((route) => ({
      label: route.route,
      throughput: route.requestCount,
      latency: Math.round(route.p95Latency),
      errorRate: route.errorRate
    }));
  }, [latencyAggregates, routePerformance, summary.errorRate]);

  const healthDistribution = [
    { label: "Healthy", value: summary.healthyServices, color: "bg-white/80" },
    { label: "Degraded", value: summary.degradedServices, color: "bg-amber/80" },
    { label: "Down", value: summary.downServices, color: "bg-red-500/80" }
  ];

  const topSlowServices = useMemo(() => {
    return [...routePerformance]
      .sort((a, b) => b.p95Latency - a.p95Latency)
      .slice(0, 5)
      .map((route) => ({ label: route.route, value: route.p95Latency }));
  }, [routePerformance]);

  const topErroringServices = useMemo(() => {
    return [...routePerformance]
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, 5)
      .map((route) => ({ label: route.route, value: route.errorRate }));
  }, [routePerformance]);

  const maxThroughput = Math.max(1, ...trendData.map((t) => t.throughput));
  const maxLatency = Math.max(1, ...trendData.map((t) => t.latency));
  const maxErrorRate = Math.max(1, ...trendData.map((t) => t.errorRate));
  const maxHealth = Math.max(1, ...healthDistribution.map((item) => item.value));
  const maxSlowRoute = Math.max(1, ...topSlowServices.map((item) => item.value));
  const maxErrorRoute = Math.max(1, ...topErroringServices.map((item) => item.value));
  const projectHealth =
    summary.downServices > 0 ? "down" : summary.degradedServices > 0 || activeIncidents.length > 0 ? "degraded" : "healthy";
  const hasNoTelemetry = summary.logsIngested === 0 && summary.metricsIngested === 0;

  async function generateSetupApiKey() {
    if (!setupService) return;
    setSetupLoading("api-key");
    try {
      const result = await createApiKey(setupService.id, `${setupService.name} setup key`);
      setSetupApiKey(result.apiKey.rawKey);
      await navigator.clipboard.writeText(result.apiKey.rawKey);
    } finally {
      setSetupLoading("");
    }
  }

  async function sendProjectTestEvent() {
    if (!setupService) return;
    setSetupLoading("test-event");
    try {
      const result = await sendServiceTestEvent(setupService.id);
      setSetupStatus(result.connectionStatus);
      await loadData();
    } finally {
      setSetupLoading("");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="grid h-10 w-10 place-items-center aegis-glass rounded-2xl text-text-soft hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">{project.name}</h1>
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-white">{projectType}</span>
            </div>
            <p className="mt-1 text-sm text-text-soft">
              Key: <span className="font-mono text-text-soft">{project.projectKey}</span> · Team: Platform Engineering
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Health: <span className="font-semibold capitalize text-text-soft">{projectHealth}</span>
              {summary.lastDeploymentAt ? ` · Last deployment ${new Date(summary.lastDeploymentAt).toLocaleString()}` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
            className="h-10 rounded-full border border-white/10 bg-white/5 px-3 text-sm text-white"
          >
            <option value="production">production</option>
            <option value="staging">staging</option>
            <option value="dev">dev</option>
          </select>

          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="h-10 rounded-full border border-white/10 bg-white/5 px-3 text-sm text-white"
          >
            <option value="1h">Last 1 hour</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
          </select>

          <button
            onClick={loadData}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-text-soft hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-white" : ""}`} />
          </button>
        </div>
      </div>

      {/* UX Monolith / Microservices banner */}
      {projectType === "Monolith" ? (
        <div className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-white/80">
          <strong>Single-service monitored application</strong> - Metrics and logs are consolidated from a single server container process.
        </div>
      ) : (
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-4 text-sm text-white">
          <strong>Microservices Architecture</strong> - Monitored across {projectServices.length} independent services and database layers.
        </div>
      )}

      {hasNoTelemetry ? (
        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-4 shadow-panel">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex gap-3">
              <Cable className="mt-1 h-5 w-5 shrink-0 text-white" />
              <div>
                <h2 className="text-base font-semibold text-white">No telemetry received yet</h2>
                <p className="mt-1 text-sm text-text-soft">
                  Generate a service key, add the environment variables, then send a test event for {setupService?.name ?? "a service"}.
                </p>
                <pre className="mt-3 overflow-auto rounded-2xl border border-white/10 bg-white/5 p-3 text-xs leading-5 text-text-primary">
                  {`AEGISOPS_ENABLED=true
AEGISOPS_API_URL=http://localhost:8080
AEGISOPS_API_KEY=${setupApiKey || "<generate-api-key>"}
AEGISOPS_PROJECT_KEY=${project.projectKey ?? ""}
AEGISOPS_SERVICE_NAME=${setupService?.name ?? "service-name"}
AEGISOPS_ENVIRONMENT=${setupService?.environment ?? environment}`}
                </pre>
                {setupStatus ? (
                  <p className="mt-2 text-xs text-white">
                    {connectionStatusLabel(setupStatus.status)}{" "}
                    {setupStatus.lastHeartbeatAt ? `at ${new Date(setupStatus.lastHeartbeatAt).toLocaleString()}` : ""}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                title="Generate API key"
                onClick={() => (setupApiKey ? navigator.clipboard.writeText(setupApiKey) : generateSetupApiKey())}
                disabled={!setupService || setupLoading === "api-key"}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-black disabled:opacity-60"
              >
                <Copy className="h-4 w-4" />
                {setupLoading === "api-key" ? "Generating" : setupApiKey ? "Copy Key" : "Generate Key"}
              </button>
              <button
                type="button"
                title="Send test event"
                onClick={sendProjectTestEvent}
                disabled={!setupService || setupLoading === "test-event"}
                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {setupLoading === "test-event" ? "Sending" : "Send Test Event"}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="aegis-glass rounded-2xl p-5 shadow-panel">
          <div className="flex items-center justify-between text-text-soft">
            <span className="text-xs font-semibold uppercase tracking-wider">Throughput</span>
            <TrendingUp className="h-4 w-4 text-white" />
          </div>
          <p className="mt-2 text-2xl font-bold text-white">
            {numberFmt(summary.requestsPerSecond, 2)} <span className="text-sm font-normal text-text-soft">req/s</span>
          </p>
          <p className="mt-1 text-xs text-text-muted">Avg request volume</p>
        </div>

        <div className="aegis-glass rounded-2xl p-5 shadow-panel">
          <div className="flex items-center justify-between text-text-soft">
            <span className="text-xs font-semibold uppercase tracking-wider">Error Rate</span>
            <AlertTriangle className="h-4 w-4 text-red-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-white">{numberFmt(summary.errorRate, 2)}%</p>
          <p className="mt-1 text-xs text-text-muted">4xx and 5xx request share</p>
        </div>

        <div className="aegis-glass rounded-2xl p-5 shadow-panel">
          <div className="flex items-center justify-between text-text-soft">
            <span className="text-xs font-semibold uppercase tracking-wider">p95 Latency</span>
            <Clock className="h-4 w-4 text-amber" />
          </div>
          <p className="mt-2 text-2xl font-bold text-white">
            {numberFmt(summary.p95LatencyMs, 0)} <span className="text-sm font-normal text-text-soft">ms</span>
          </p>
          <p className="mt-1 text-xs text-text-muted">Slowest 5% response time</p>
        </div>

        <div className="aegis-glass rounded-2xl p-5 shadow-panel">
          <div className="flex items-center justify-between text-text-soft">
            <span className="text-xs font-semibold uppercase tracking-wider">Uptime</span>
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <p className="mt-2 text-2xl font-bold text-white">{numberFmt(summary.uptimePercent, 2)}%</p>
          <p className="mt-1 text-xs text-text-muted">Service health coverage</p>
        </div>

        <div className="aegis-glass rounded-2xl p-5 shadow-panel">
          <div className="flex items-center justify-between text-text-soft">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Incidents</span>
            <Siren className="h-4 w-4 text-red-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-white">{summary.activeIncidents}</p>
          <p className="mt-1 text-xs text-text-muted">Open events needing care</p>
        </div>

        <div className="aegis-glass rounded-2xl p-5 shadow-panel">
          <div className="flex items-center justify-between text-text-soft">
            <span className="text-xs font-semibold uppercase tracking-wider">Services</span>
            <Server className="h-4 w-4 text-white" />
          </div>
          <p className="mt-2 text-2xl font-bold text-white">{summary.servicesCount}</p>
          <p className="mt-1 text-xs text-text-muted">{projectType}</p>
        </div>

        <div className="aegis-glass rounded-2xl p-5 shadow-panel">
          <div className="flex items-center justify-between text-text-soft">
            <span className="text-xs font-semibold uppercase tracking-wider">Logs Ingested</span>
            <Logs className="h-4 w-4 text-text-soft" />
          </div>
          <p className="mt-2 text-2xl font-bold text-white">{numberFmt(summary.logsIngested, 0)}</p>
          <p className="mt-1 text-xs text-text-muted">Selected time range</p>
        </div>

        <div className="aegis-glass rounded-2xl p-5 shadow-panel">
          <div className="flex items-center justify-between text-text-soft">
            <span className="text-xs font-semibold uppercase tracking-wider">Metrics Ingested</span>
            <Activity className="h-4 w-4 text-white" />
          </div>
          <p className="mt-2 text-2xl font-bold text-white">{numberFmt(summary.metricsIngested, 0)}</p>
          <p className="mt-1 text-xs text-text-muted">Selected time range</p>
        </div>
      </div>

      {/* SVG Charts section */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Throughput chart */}
        <div className="aegis-glass rounded-2xl p-5 shadow-panel">
          <h3 className="mb-4 text-sm font-semibold text-white">Throughput Over Time (req/s)</h3>
          <div className="flex h-36 items-end gap-2 rounded bg-white/5 p-3">
            {trendData.map((d, i) => (
              <div key={i} className="flex h-full flex-1 flex-col justify-end items-center group relative">
                <div
                  style={{ height: `${(d.throughput / maxThroughput) * 100}%` }}
                  className="w-full rounded bg-white/80 hover:bg-white transition-colors"
                />
                <span className="absolute bottom-full mb-1 scale-0 rounded bg-white/5 px-2 py-1 text-[10px] text-white group-hover:scale-100 transition-all z-10">
                  {d.throughput} req/s
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Latency chart */}
        <div className="aegis-glass rounded-2xl p-5 shadow-panel">
          <h3 className="mb-4 text-sm font-semibold text-white">p95 Latency Over Time (ms)</h3>
          <div className="flex h-36 items-end gap-2 rounded bg-white/5 p-3">
            {trendData.map((d, i) => (
              <div key={i} className="flex h-full flex-1 flex-col justify-end items-center group relative">
                <div
                  style={{ height: `${(d.latency / maxLatency) * 100}%` }}
                  className="w-full rounded bg-amber/80 hover:bg-amber transition-colors"
                />
                <span className="absolute bottom-full mb-1 scale-0 rounded bg-white/5 px-2 py-1 text-[10px] text-white group-hover:scale-100 transition-all z-10">
                  {d.latency} ms
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Error rate chart */}
        <div className="aegis-glass rounded-2xl p-5 shadow-panel">
          <h3 className="mb-4 text-sm font-semibold text-white">Error Rate (%)</h3>
          <div className="flex h-36 items-end gap-2 rounded bg-white/5 p-3">
            {trendData.map((d, i) => (
              <div key={i} className="flex h-full flex-1 flex-col justify-end items-center group relative">
                <div
                  style={{ height: `${(d.errorRate / maxErrorRate) * 100}%` }}
                  className="w-full rounded bg-red-500/80 hover:bg-red-500 transition-colors"
                />
                <span className="absolute bottom-full mb-1 scale-0 rounded bg-white/5 px-2 py-1 text-[10px] text-white group-hover:scale-100 transition-all z-10">
                  {d.errorRate}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="aegis-glass rounded-2xl p-5 shadow-panel">
          <h3 className="mb-4 text-sm font-semibold text-white">Service Health Distribution</h3>
          <div className="space-y-3">
            {healthDistribution.map((item) => (
              <div key={item.label}>
                <div className="mb-1 flex items-center justify-between text-xs text-text-soft">
                  <span>{item.label}</span>
                  <span>{item.value}</span>
                </div>
                <div className="h-2 rounded bg-white/5">
                  <div className={`h-2 rounded ${item.color}`} style={{ width: `${(item.value / maxHealth) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="aegis-glass rounded-2xl p-5 shadow-panel">
          <h3 className="mb-4 text-sm font-semibold text-white">Top Slow Routes</h3>
          <div className="space-y-3">
            {topSlowServices.map((item) => (
              <div key={item.label}>
                <div className="mb-1 flex items-center justify-between gap-3 text-xs text-text-soft">
                  <span className="truncate font-mono">{item.label}</span>
                  <span>{numberFmt(item.value, 0)}ms</span>
                </div>
                <div className="h-2 rounded bg-white/5">
                  <div className="h-2 rounded bg-amber/80" style={{ width: `${(item.value / maxSlowRoute) * 100}%` }} />
                </div>
              </div>
            ))}
            {topSlowServices.length === 0 ? <p className="text-xs text-text-muted">No route latency data.</p> : null}
          </div>
        </div>

        <div className="aegis-glass rounded-2xl p-5 shadow-panel">
          <h3 className="mb-4 text-sm font-semibold text-white">Top Erroring Routes</h3>
          <div className="space-y-3">
            {topErroringServices.map((item) => (
              <div key={item.label}>
                <div className="mb-1 flex items-center justify-between gap-3 text-xs text-text-soft">
                  <span className="truncate font-mono">{item.label}</span>
                  <span>{numberFmt(item.value, 2)}%</span>
                </div>
                <div className="h-2 rounded bg-white/5">
                  <div className="h-2 rounded bg-red-500/80" style={{ width: `${(item.value / maxErrorRoute) * 100}%` }} />
                </div>
              </div>
            ))}
            {topErroringServices.length === 0 ? <p className="text-xs text-text-muted">No route error data.</p> : null}
          </div>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left two columns */}
        <div className="space-y-6 lg:col-span-2">
          {/* Services Table */}
          <div className="aegis-glass rounded-2xl p-5 shadow-panel">
            <h3 className="mb-4 text-base font-semibold text-white">Services Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-text-soft">
                <thead>
                  <tr className="border-b border-white/10 text-xs font-semibold uppercase text-text-soft">
                    <th className="pb-3">Name</th>
                    <th className="pb-3">Type</th>
                    <th className="pb-3">Runtime</th>
                    <th className="pb-3 text-center">Status</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {projectServices.map((service) => (
                    <tr key={service.id} className="hover:bg-white/5/50">
                      <td className="py-3 font-medium text-white">
                        <button
                          onClick={() => onSelectService(service.id)}
                          className="hover:text-white hover:underline text-left font-semibold"
                        >
                          {service.name}
                        </button>
                      </td>
                      <td className="py-3 capitalize">{service.serviceType || "api"}</td>
                      <td className="py-3 capitalize text-text-soft">{service.language || "node"}</td>
                      <td className="py-3 text-center">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            service.healthStatus === "healthy" || service.healthStatus === "ok"
                              ? "bg-white/10 text-white"
                              : "bg-amber/15 text-amber"
                          }`}
                        >
                          {service.healthStatus || "healthy"}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => onSelectService(service.id)}
                          className="inline-flex items-center gap-1 text-xs text-white hover:text-white/80"
                        >
                          View <ExternalLink className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {projectServices.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-text-soft">
                        No active services found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          {/* Route Performance Summary */}
          <div className="aegis-glass rounded-2xl p-5 shadow-panel">
            <h3 className="mb-4 text-base font-semibold text-white">Route Performance (Across Services)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-text-soft">
                <thead>
                  <tr className="border-b border-white/10 text-xs font-semibold uppercase text-text-soft">
                    <th className="pb-3">Endpoint</th>
                    <th className="pb-3">Method</th>
                    <th className="pb-3 text-center">Requests</th>
                    <th className="pb-3 text-right">Avg Latency</th>
                    <th className="pb-3 text-right">p95 Latency</th>
                    <th className="pb-3 text-right">Errors</th>
                    <th className="pb-3 text-right">Error Rate</th>
                    <th className="pb-3 text-center">2xx/4xx/5xx</th>
                    <th className="pb-3 text-right">Last Seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {routePerformance.map((route, i) => (
                    <tr key={i} className="hover:bg-white/5/50">
                      <td className="py-3 font-mono text-xs text-text-primary">{route.route}</td>
                      <td className="py-3">
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            route.method === "POST"
                              ? "bg-white/10 text-white"
                              : route.method === "DELETE"
                                ? "bg-red-500/15 text-red-400"
                                : "bg-emerald-500/15 text-emerald-400"
                          }`}
                        >
                          {route.method}
                        </span>
                      </td>
                      <td className="py-3 text-center font-mono">{route.requestCount}</td>
                      <td className="py-3 text-right font-mono">{route.avgLatency}ms</td>
                      <td className="py-3 text-right font-mono text-amber">{route.p95Latency}ms</td>
                      <td className="py-3 text-right font-mono text-red-300">{route.errorCount}</td>
                      <td className="py-3 text-right font-mono text-red-400">{route.errorRate}%</td>
                      <td className="py-3 text-center text-xs text-text-soft">
                        {route.status2xx} / {route.status4xx} / {route.status5xx}
                      </td>
                      <td className="py-3 text-right text-xs text-text-muted">
                        {route.lastSeen ? new Date(route.lastSeen).toLocaleTimeString() : "-"}
                      </td>
                    </tr>
                  ))}
                  {routePerformance.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-text-muted">
                        No route performance telemetry received yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          {/* Real-time Logs section */}
          <div className="aegis-glass rounded-2xl p-5 shadow-panel">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Recent Telemetry Logs</h3>
              <Logs className="h-5 w-5 text-text-soft" />
            </div>
            <div className="max-h-72 overflow-y-auto rounded bg-[#070b0e] p-3 font-mono text-xs text-text-soft">
              {logs.map((log, index) => (
                <div key={index} className="py-1 border-b border-slate-950/20 last:border-0 flex items-start gap-3">
                  <span className="text-text-muted">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                  <span
                    className={`font-semibold uppercase ${
                      log.level === "error" ? "text-red-400" : log.level === "warn" ? "text-amber" : "text-white"
                    }`}
                  >
                    {log.level}
                  </span>
                  <span className="text-text-soft">[{log.serviceName}]</span>
                  <span className="text-text-primary">{log.message}</span>
                  {log.route && (
                    <span className="text-text-muted">
                      ({log.method} {log.route} {log.statusCode})
                    </span>
                  )}
                </div>
              ))}
              {logs.length === 0 ? <p className="text-text-muted text-center">No logs ingested.</p> : null}
            </div>
          </div>
        </div>

        {/* Right sidebar column */}
        <div className="space-y-6">
          {/* AI Project Health Summary */}
          <div className="rounded-2xl border border-white/15 bg-gradient-to-br from-white/5 to-black/40 p-5 shadow-panel">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                <Sparkles className="h-4 w-4 text-white animate-pulse" />
                AI Health summary
              </h3>
              <button
                disabled={generatingAi}
                onClick={generateAiSummary}
                className="inline-flex h-8 items-center gap-1.5 rounded bg-white px-3 text-xs font-semibold text-black disabled:opacity-50"
              >
                <Wand2 className="h-3 w-3" />
                Analyze
              </button>
            </div>

            {generatingAi && (
              <div className="py-8 text-center text-sm text-text-soft animate-pulse">
                Analyzing recent telemetry, logs, and RCA report cards...
              </div>
            )}

            {!generatingAi && aiSummary ? (
              <div className="prose prose-invert prose-xs text-xs text-text-soft space-y-3">
                <div className="rounded border border-white/10 bg-white/5 p-3 text-[11px] leading-relaxed whitespace-pre-line font-mono">
                  {aiSummary}
                </div>
              </div>
            ) : !generatingAi ? (
              <p className="text-xs text-text-soft">
                Click Analyze to trigger the AegisOps AI Engine to inspect log severity trends, active incidents, and rollups.
              </p>
            ) : null}
          </div>

          {/* Active Incidents */}
          <div className="aegis-glass rounded-2xl p-5 shadow-panel">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Active Incidents</h3>
              <span className="rounded bg-red-500/15 px-2 py-0.5 text-xs text-red-400 font-semibold">{activeIncidents.length}</span>
            </div>
            <div className="space-y-3">
              {activeIncidents.map((incident) => (
                <div key={incident.id} className="rounded border border-white/10 bg-white/5 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-white truncate">{incident.title}</p>
                    <span className="text-[10px] uppercase font-bold text-red-400">{incident.severity}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-text-soft truncate">{incident.summary}</p>
                  <p className="mt-2 text-[10px] text-text-muted">{new Date(incident.createdAt).toLocaleString()}</p>
                </div>
              ))}
              {activeIncidents.length === 0 ? (
                <div className="py-4 text-center text-xs text-text-soft flex flex-col items-center gap-2">
                  <CheckCircle2 className="h-6 w-6 text-white" />
                  No active incidents. Uptime is healthy!
                </div>
              ) : null}
            </div>
          </div>

          {/* Alert Rules */}
          <div className="aegis-glass rounded-2xl p-5 shadow-panel">
            <h3 className="mb-4 text-sm font-semibold text-white">Alert Rules Status</h3>
            <div className="space-y-2.5">
              {alertRules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between text-xs text-text-soft">
                  <div>
                    <p className="font-semibold text-white">{rule.name}</p>
                    <p className="text-[10px] text-text-soft">
                      {rule.metric} {rule.operator} {rule.threshold}
                    </p>
                  </div>
                  <span className={`h-2.5 w-2.5 rounded-full ${rule.enabled ? "bg-white" : "bg-line"}`} />
                </div>
              ))}
              {alertRules.length === 0 ? <p className="text-xs text-text-muted text-center">No alert rules configured.</p> : null}
            </div>
          </div>

          {/* Recent Deployments */}
          <div className="aegis-glass rounded-2xl p-5 shadow-panel">
            <h3 className="mb-4 text-sm font-semibold text-white">Recent Deployments</h3>
            <div className="space-y-3">
              {deployments.map((d) => (
                <div key={d.id} className="flex items-start gap-2 text-xs">
                  <GitBranch className="h-4 w-4 mt-0.5 text-white" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white truncate">{d.serviceName}</p>
                    <p className="text-[10px] text-text-soft">
                      {d.version || "v1.0"} · commit <span className="font-mono">{d.commitSha?.slice(0, 6) || "abc123"}</span>
                    </p>
                  </div>
                  <span className="text-[10px] text-text-muted">{new Date(d.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
              {deployments.length === 0 ? <p className="text-xs text-text-muted text-center">No deployments logged.</p> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
