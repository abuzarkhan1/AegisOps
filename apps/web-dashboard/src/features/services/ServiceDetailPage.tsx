import { useEffect, useState, useMemo } from "react";
import { ArrowLeft, Activity, CheckCircle2, Database, Layers, GitBranch, RefreshCw } from "lucide-react";
import {
  fetchIncidents,
  fetchDeployments,
  fetchLogs,
  fetchAlertRules,
  fetchRoutePerformance,
  fetchMetrics,
  fetchMetricAggregates,
  fetchProject,
  fetchService,
  fetchServiceDetailSummary,
  type ProjectRecord,
  type ServiceRecord,
  type IncidentRecord,
  type DeploymentRecord,
  type AlertRuleRecord,
  type MetricAggregateRecord,
  type ServiceDetailSummary
} from "../../shared/api/core";

type ServiceDetailPageProps = {
  serviceId: string;
  onBack: () => void;
};

const emptySummary: ServiceDetailSummary = {
  totalThroughput: 0,
  latencySamples: 0,
  requestsPerSecond: 0,
  errorRate: 0,
  p50LatencyMs: 0,
  p95LatencyMs: 0,
  p99LatencyMs: 0,
  activeIncidents: 0,
  logVolume: 0,
  uptimePercent: 0
};

const timeRangeToFrom = (range: string) => {
  const hours = range === "1h" ? 1 : range === "7d" ? 24 * 7 : 24;
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
};

const numberFmt = (value: number, digits = 1) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(Number.isFinite(value) ? value : 0);

export function ServiceDetailPage({ serviceId, onBack }: ServiceDetailPageProps) {
  const [service, setService] = useState<ServiceRecord | null>(null);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRuleRecord[]>([]);
  const [routePerformance, setRoutePerformance] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [summary, setSummary] = useState<ServiceDetailSummary>(emptySummary);
  const [latencyAggregates, setLatencyAggregates] = useState<MetricAggregateRecord[]>([]);

  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState("24h");

  async function loadData() {
    setLoading(true);
    try {
      const currentService = await fetchService(serviceId);
      setService(currentService);

      const from = timeRangeToFrom(timeRange);
      const [currentProject, allIncidents, allDeployments, allLogs, allRules, performance, allMetrics, detailSummary, aggregates] =
        await Promise.all([
          currentService.projectId ? fetchProject(currentService.projectId) : Promise.resolve(null),
          fetchIncidents(),
          fetchDeployments(),
          fetchLogs({ serviceId: currentService.id, environment: currentService.environment, from, limit: 15 }),
          fetchAlertRules(),
          fetchRoutePerformance(currentService.projectId || "", currentService.id, { environment: currentService.environment, from }),
          fetchMetrics({ serviceId: currentService.id, environment: currentService.environment, from, limit: 100 }),
          fetchServiceDetailSummary(currentService.id, { environment: currentService.environment, from }),
          fetchMetricAggregates({
            serviceId: currentService.id,
            environment: currentService.environment,
            metricName: "http_request_duration_ms",
            window: "1m",
            from,
            limit: 60
          })
        ]);

      setProject(currentProject);
      setIncidents(allIncidents.filter((inc: any) => inc.serviceId === currentService.id));
      setDeployments(allDeployments.filter((d: any) => d.serviceName === currentService.name));
      setLogs(allLogs);
      setAlertRules(allRules.filter((r) => r.serviceId === currentService.id));
      setRoutePerformance(performance || []);
      setMetrics(allMetrics || []);
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
  }, [serviceId, timeRange]);

  const activeIncidents = incidents.filter((inc) => inc.status !== "resolved");

  // Specialized panel rendering based on serviceType
  const normalizedType = (service?.serviceType || "").toLowerCase();

  const serviceName = service?.name.toLowerCase() ?? "";
  const isCache = normalizedType === "cache" || serviceName.includes("redis");
  const isDb = normalizedType === "database" || normalizedType === "db" || serviceName.includes("postgres");
  const isQueue =
    normalizedType === "queue" || normalizedType === "message-broker" || serviceName.includes("rabbit") || serviceName.includes("kafka");

  const metricValue = (names: string[], fallback = 0) => {
    const match = metrics.find((metric) => names.includes(metric.metricName));
    return typeof match?.value === "number" ? match.value : fallback;
  };

  const trendData = useMemo(() => {
    return [...latencyAggregates]
      .reverse()
      .slice(-12)
      .map((row) => ({
        label: new Date(row.timestampBucket).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        throughput: row.count,
        p50: Math.round(row.p50),
        p95: Math.round(row.p95),
        p99: Math.round(row.p99)
      }));
  }, [latencyAggregates]);

  const maxThroughput = Math.max(1, ...trendData.map((t) => t.throughput));
  const maxLatency = Math.max(1, ...trendData.map((t) => t.p99));

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
              <h1 className="text-2xl font-bold text-white">{service?.name}</h1>
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-white">
                {service?.serviceType || "api"}
              </span>
            </div>
            <p className="mt-1 text-sm text-text-soft">
              Project: <span className="font-semibold text-text-soft">{project?.name || "Loading..."}</span> · Env:{" "}
              <span className="font-semibold text-text-soft">{service?.environment}</span>
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Health: <span className="font-semibold capitalize text-text-soft">{service?.healthStatus ?? "unknown"}</span>
              {summary.lastMetricAt ? ` · Last metric ${new Date(summary.lastMetricAt).toLocaleString()}` : ""}
              {summary.lastLogAt ? ` · Last log ${new Date(summary.lastLogAt).toLocaleString()}` : ""}
              {" · API key active"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
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

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="aegis-glass rounded-2xl p-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-soft">Throughput</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {numberFmt(summary.requestsPerSecond, 2)} <span className="text-sm font-normal text-text-soft">req/s</span>
          </p>
          <p className="mt-1 text-xs text-text-muted">Selected time range</p>
        </div>

        <div className="aegis-glass rounded-2xl p-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-soft">Latency (p50/p95/p99)</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {numberFmt(summary.p50LatencyMs, 0)} <span className="text-sm font-normal text-text-soft">/</span>{" "}
            {numberFmt(summary.p95LatencyMs, 0)} <span className="text-sm font-normal text-text-soft">/</span>{" "}
            {numberFmt(summary.p99LatencyMs, 0)} <span className="text-xs font-normal text-text-muted">ms</span>
          </p>
          <p className="mt-1 text-xs text-text-muted">Percentile buckets</p>
        </div>

        <div className="aegis-glass rounded-2xl p-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-soft">Error Rate</p>
          <p className="mt-2 text-2xl font-bold text-white">{numberFmt(summary.errorRate, 2)}%</p>
          <p className="mt-1 text-xs text-text-muted">4xx and 5xx request share</p>
        </div>

        <div className="aegis-glass rounded-2xl p-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-soft">Uptime</p>
          <p className="mt-2 text-2xl font-bold text-white">{numberFmt(summary.uptimePercent, 2)}%</p>
          <p className="mt-1 text-xs text-text-muted">Calculated over {timeRange}</p>
        </div>

        <div className="aegis-glass rounded-2xl p-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-soft">Active Incidents</p>
          <p className="mt-2 text-2xl font-bold text-white">{summary.activeIncidents}</p>
          <p className="mt-1 text-xs text-text-muted">Open service incidents</p>
        </div>

        <div className="aegis-glass rounded-2xl p-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-soft">Log Volume</p>
          <p className="mt-2 text-2xl font-bold text-white">{numberFmt(summary.logVolume, 0)}</p>
          <p className="mt-1 text-xs text-text-muted">Selected time range</p>
        </div>
      </div>

      {/* Specialized Panels depending on type */}
      {isCache && (
        <div className="grid gap-4 md:grid-cols-4 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-5">
          <div className="md:col-span-4 flex items-center gap-2 border-b border-indigo-500/10 pb-2">
            <Layers className="h-5 w-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Redis Cache specialized telemetry</h3>
          </div>
          <div>
            <p className="text-xs text-text-soft font-semibold uppercase">Cache Hit Ratio</p>
            <p className="text-xl font-bold text-white mt-1">{numberFmt(metricValue(["redis_cache_hit_ratio"]), 2)}%</p>
          </div>
          <div>
            <p className="text-xs text-text-soft font-semibold uppercase">Connected Clients</p>
            <p className="text-xl font-bold text-white mt-1">{numberFmt(metricValue(["redis_connected_clients"], 0), 0)} active</p>
          </div>
          <div>
            <p className="text-xs text-text-soft font-semibold uppercase">Memory Used</p>
            <p className="text-xl font-bold text-white mt-1">
              {numberFmt(metricValue(["redis_memory_used_bytes"], 0) / 1024 / 1024, 1)} MB
            </p>
          </div>
          <div>
            <p className="text-xs text-text-soft font-semibold uppercase">Evicted Keys</p>
            <p className="text-xl font-bold text-white mt-1">{numberFmt(metricValue(["redis_evicted_keys_total"], 0), 0)}</p>
          </div>
        </div>
      )}

      {isDb && (
        <div className="grid gap-4 md:grid-cols-4 rounded-2xl border border-white/15 bg-white/5 p-5">
          <div className="md:col-span-4 flex items-center gap-2 border-b border-white/10 pb-2">
            <Database className="h-5 w-5 text-white" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">PostgreSQL DB specialized telemetry</h3>
          </div>
          <div>
            <p className="text-xs text-text-soft font-semibold uppercase">Active Connections</p>
            <p className="text-xl font-bold text-white mt-1">
              {numberFmt(metricValue(["postgres_connections_active"], 0), 0)} / {numberFmt(metricValue(["postgres_connections_max"], 0), 0)}{" "}
              max
            </p>
          </div>
          <div>
            <p className="text-xs text-text-soft font-semibold uppercase">Avg DB Query Latency</p>
            <p className="text-xl font-bold text-white mt-1 text-amber">
              {numberFmt(metricValue(["postgres_query_duration_ms", "postgres_query_latency_ms"], 0), 1)} ms
            </p>
          </div>
          <div>
            <p className="text-xs text-text-soft font-semibold uppercase">Buffer Cache Hit Ratio</p>
            <p className="text-xl font-bold text-white mt-1">{numberFmt(metricValue(["postgres_cache_hit_ratio"], 0), 2)}%</p>
          </div>
          <div>
            <p className="text-xs text-text-soft font-semibold uppercase">Deadlocks</p>
            <p className="text-xl font-bold text-white mt-1 text-emerald-400">
              {numberFmt(metricValue(["postgres_deadlocks_total"], 0), 0)}
            </p>
          </div>
        </div>
      )}

      {isQueue && (
        <div className="grid gap-4 md:grid-cols-4 rounded-2xl border border-amber/20 bg-amber/5 p-5">
          <div className="md:col-span-4 flex items-center gap-2 border-b border-amber/10 pb-2">
            <Activity className="h-5 w-5 text-amber" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Async Queue/Broker specialized telemetry</h3>
          </div>
          <div>
            <p className="text-xs text-text-soft font-semibold uppercase">Queue Depth</p>
            <p className="text-xl font-bold text-white mt-1">
              {numberFmt(metricValue(["rabbitmq_queue_depth", "kafka_consumer_lag"], 0), 0)} pending
            </p>
          </div>
          <div>
            <p className="text-xs text-text-soft font-semibold uppercase">Messages In</p>
            <p className="text-xl font-bold text-white mt-1">
              {numberFmt(metricValue(["kafka_messages_in_total", "rabbitmq_messages_published_total"], 0), 0)}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-soft font-semibold uppercase">Consumer Lag</p>
            <p className="text-xl font-bold text-white mt-1 text-emerald-400">{numberFmt(metricValue(["kafka_consumer_lag"], 0), 0)}</p>
          </div>
          <div>
            <p className="text-xs text-text-soft font-semibold uppercase">Failed Messages</p>
            <p className="text-xl font-bold text-white mt-1 text-emerald-400">
              {numberFmt(metricValue(["rabbitmq_messages_failed_total"], 0), 0)}
            </p>
          </div>
        </div>
      )}

      {/* SVG Charts section */}
      <div className="grid gap-6 md:grid-cols-2">
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

        <div className="aegis-glass rounded-2xl p-5 shadow-panel">
          <h3 className="mb-4 text-sm font-semibold text-white">Latency p50/p95/p99 (ms)</h3>
          <div className="flex h-36 items-end gap-2 rounded bg-white/5 p-3">
            {trendData.map((d, i) => (
              <div key={i} className="flex h-full flex-1 flex-col justify-end items-center group relative">
                {/* Draw p99 as a tall segment, p95 as medium, p50 as base */}
                <div className="w-full flex flex-col justify-end h-full">
                  <div style={{ height: `${(d.p99 / maxLatency) * 100}%` }} className="w-full rounded bg-[#e11d48]/80 hover:bg-[#e11d48]" />
                </div>
                <span className="absolute bottom-full mb-1 scale-0 rounded bg-white/5 px-2 py-1 text-[10px] text-white group-hover:scale-100 transition-all z-10">
                  p50:{d.p50} / p95:{d.p95} / p99:{d.p99} ms
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main tables and detail sections */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Route Performance Table */}
          <div className="aegis-glass rounded-2xl p-5 shadow-panel">
            <h3 className="mb-4 text-base font-semibold text-white">Route Performance Grid</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-text-soft">
                <thead>
                  <tr className="border-b border-white/10 text-xs font-semibold uppercase text-text-soft">
                    <th className="pb-3">Route</th>
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
                            route.method === "POST" ? "bg-white/10 text-white" : "bg-emerald-500/15 text-emerald-400"
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
                        No route performance data.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          {/* Service Logs */}
          <div className="aegis-glass rounded-2xl p-5 shadow-panel">
            <h3 className="mb-4 text-base font-semibold text-white">Recent Service Logs</h3>
            <div className="max-h-60 overflow-y-auto rounded bg-[#070b0e] p-3 font-mono text-xs text-text-soft">
              {logs.map((log, index) => (
                <div key={index} className="py-1 flex items-start gap-3">
                  <span className="text-text-muted">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                  <span
                    className={`font-semibold uppercase ${
                      log.level === "error" ? "text-red-400" : log.level === "warn" ? "text-amber" : "text-white"
                    }`}
                  >
                    {log.level}
                  </span>
                  <span className="text-text-primary">{log.message}</span>
                </div>
              ))}
              {logs.length === 0 ? <p className="text-text-muted text-center">No logs ingested.</p> : null}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Active Service Incidents */}
          <div className="aegis-glass rounded-2xl p-5 shadow-panel">
            <h3 className="mb-4 text-sm font-semibold text-white">Active Service Incidents</h3>
            <div className="space-y-3">
              {activeIncidents.map((incident) => (
                <div key={incident.id} className="rounded border border-white/10 bg-white/5 p-3">
                  <p className="text-xs font-semibold text-white">{incident.title}</p>
                  <p className="mt-1 text-[11px] text-text-soft">{incident.summary}</p>
                  <p className="mt-2 text-[10px] text-text-muted">{new Date(incident.createdAt).toLocaleTimeString()}</p>
                </div>
              ))}
              {activeIncidents.length === 0 ? (
                <div className="py-4 text-center text-xs text-text-soft flex flex-col items-center gap-2">
                  <CheckCircle2 className="h-6 w-6 text-white" />
                  No open incidents on this service.
                </div>
              ) : null}
            </div>
          </div>

          {/* Alert Rules */}
          <div className="aegis-glass rounded-2xl p-5 shadow-panel">
            <h3 className="mb-4 text-sm font-semibold text-white">Alert Rules</h3>
            <div className="space-y-2">
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

          {/* Service Deployments */}
          <div className="aegis-glass rounded-2xl p-5 shadow-panel">
            <h3 className="text-sm font-semibold text-white mb-4">Deployments</h3>
            <div className="space-y-3">
              {deployments.map((d) => (
                <div key={d.id} className="flex items-start gap-2 text-xs">
                  <GitBranch className="h-4 w-4 mt-0.5 text-white" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white truncate">{d.version || "v1.0.1"}</p>
                    <p className="text-[10px] text-text-soft font-mono">commit {d.commitSha?.slice(0, 6)}</p>
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
