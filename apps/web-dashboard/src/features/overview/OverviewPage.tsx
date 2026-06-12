import { RadioTower, ShieldCheck, Siren, Activity, GitBranch, Cable, ArrowRight, BarChart3 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys, queryStaleTimes } from "../../app/queryClient";
import type { HealthResult } from "../../shared/api/health";
import {
  fetchDashboardSummary,
  fetchDeployments,
  fetchErrorTrends,
  fetchIncidents,
  type DeploymentRecord,
  type IncidentRecord
} from "../../shared/api/core";
import { MetricRow } from "../../shared/ui/MetricRow";
import { SetupChecklist } from "../../shared/ui/SetupChecklist";
import { GatewayRoutesPanel } from "./components/GatewayRoutesPanel";
import { SecurityPosturePanel } from "./components/SecurityPosturePanel";
import { ServiceHealthPanel } from "./components/ServiceHealthPanel";

const serviceTargets = [
  { name: "Gateway", icon: ShieldCheck },
  { name: "Core API", icon: RadioTower }
];

export function OverviewPage({ health, onNavigate }: { health: Record<string, HealthResult>; onNavigate?: (label: string) => void }) {
  const summaryQuery = useQuery({
    queryKey: queryKeys.overview(),
    queryFn: () => fetchDashboardSummary(),
    staleTime: queryStaleTimes.overview
  });
  const trendQuery = useQuery({
    queryKey: queryKeys.errorTrends(24),
    queryFn: () => fetchErrorTrends(24),
    staleTime: queryStaleTimes.metrics
  });
  const incidentsQuery = useQuery({
    queryKey: queryKeys.incidents({ limit: 5 }),
    queryFn: async () => (await fetchIncidents()).slice(0, 5),
    staleTime: queryStaleTimes.overview
  });
  const deploymentsQuery = useQuery({
    queryKey: queryKeys.deployments({ limit: 5 }),
    queryFn: async () => (await fetchDeployments()).slice(0, 5),
    staleTime: queryStaleTimes.overview
  });

  const summary: Record<string, number> = summaryQuery.data ?? {};
  const trends = trendQuery.data ?? [];
  const incidents: IncidentRecord[] = incidentsQuery.data ?? [];
  const deployments: DeploymentRecord[] = deploymentsQuery.data ?? [];
  const trendPoints = trends.map((item, index) => {
    const bucketParts = String(item.bucket ?? index).split("T");
    return {
      label: bucketParts[1]?.slice(0, 5) ?? String(index + 1),
      value: Number(item.incidents ?? 0)
    };
  });
  const maxTrend = Math.max(...trendPoints.map((item) => item.value), 1);
  const overviewStats = [
    { label: "Projects", value: String(summary.projectsMonitored ?? 0) },
    { label: "Services", value: String(summary.servicesMonitored ?? 0) },
    { label: "Healthy", value: String(summary.healthyServices ?? 0) },
    { label: "Degraded", value: String(summary.degradedServices ?? 0) },
    { label: "Down", value: String(summary.downServices ?? 0) },
    { label: "Open Incidents", value: String(summary.openIncidents ?? 0) },
    { label: "Critical", value: String(summary.criticalIncidents ?? 0) },
    { label: "Req / Sec", value: Number(summary.requestsPerSecond ?? 0).toFixed(2), detail: "Current request throughput" },
    { label: "Throughput", value: String(Math.round(Number(summary.totalThroughput ?? 0))), detail: "Requests and events handled" },
    { label: "Error Rate", value: `${Number(summary.errorRate ?? 0).toFixed(1)}%`, detail: "Failed request percentage" },
    { label: "P95 Latency", value: `${Math.round(Number(summary.p95LatencyMs ?? 0))}ms`, detail: "95% of requests were faster" },
    { label: "Uptime", value: `${Number(summary.uptimePercent ?? 0).toFixed(1)}%` },
    { label: "Logs Ingested", value: String(summary.logsIngested ?? 0) },
    { label: "Metrics Ingested", value: String(summary.metricsIngested ?? 0) }
  ];
  const noTelemetry =
    Number(summary.projectsMonitored ?? 0) === 0 ||
    Number(summary.servicesMonitored ?? 0) === 0 ||
    (Number(summary.logsIngested ?? 0) === 0 && Number(summary.metricsIngested ?? 0) === 0);

  return (
    <div className="space-y-4">
      {noTelemetry ? (
        <section className="rounded-lg border border-white/20 bg-white/[0.06] p-4 shadow-panel">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <Cable className="mt-1 h-5 w-5 shrink-0 text-white" aria-hidden="true" />
              <div>
                <h2 className="text-base font-semibold text-white">No monitored telemetry yet</h2>
                <p className="mt-1 text-sm text-text-soft">
                  Connect a project, generate an API key, then send a test event to verify logs and metrics.
                </p>
              </div>
            </div>
            <button
              type="button"
              title="Connect Project"
              onClick={() => onNavigate?.("Connect Project")}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-black"
            >
              Connect Project
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </section>
      ) : null}

      <SetupChecklist onNavigate={onNavigate} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {overviewStats.map((item) => (
          <div key={item.label} className="rounded-lg border border-line bg-panel p-4 shadow-panel">
            <MetricRow label={item.label} value={item.value} />
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <ServiceHealthPanel targets={serviceTargets} health={health} />
        <SecurityPosturePanel />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr_1fr]">
        <section className="rounded-lg border border-line bg-panel p-4 shadow-panel">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Error Trend</h2>
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <div className="flex h-36 items-end gap-2 rounded-lg border border-line bg-panel-soft p-3">
            {trendQuery.isLoading ? (
              <p className="self-center text-sm text-text-soft">Loading trend...</p>
            ) : trendPoints.length === 0 ? (
              <p className="self-center text-sm text-text-soft">No incidents in this window</p>
            ) : (
              trendPoints.map((bucket, index) => (
                <div key={`${bucket.label}-${index}`} className="flex h-full flex-1 items-end">
                  <div
                    title={`${bucket.label}: ${bucket.value}`}
                    className="w-full rounded-t bg-white/80"
                    style={{ height: `${Math.max(6, (bucket.value / maxTrend) * 100)}%` }}
                  />
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-lg border border-line bg-panel p-4 shadow-panel">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Recent Incidents</h2>
            <Siren className="h-5 w-5 text-amber" />
          </div>
          <div className="space-y-3">
            {incidents.map((incident) => (
              <div key={incident.id} className="rounded-lg border border-line bg-panel-soft p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium text-white">{incident.title}</p>
                  <span className="rounded-md bg-panel-hover px-2 py-1 text-xs text-text-soft">{incident.severity}</span>
                </div>
                <p className="mt-1 text-xs capitalize text-text-soft">{incident.status}</p>
              </div>
            ))}
            {incidents.length === 0 ? <p className="text-sm text-text-soft">No recent incidents</p> : null}
          </div>
        </section>

        <section className="rounded-lg border border-line bg-panel p-4 shadow-panel">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Recent Deployments</h2>
            <GitBranch className="h-5 w-5 text-white" />
          </div>
          <div className="space-y-3">
            {deployments.map((deployment) => (
              <div key={deployment.id} className="rounded-lg border border-line bg-panel-soft p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium text-white">{deployment.serviceName}</p>
                  <span className="rounded-md bg-panel-hover px-2 py-1 text-xs text-text-soft">
                    {deployment.status ?? deployment.provider}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-text-soft">
                  {deployment.branch ?? deployment.commitSha ?? deployment.environment}
                </p>
              </div>
            ))}
            {deployments.length === 0 ? <p className="text-sm text-text-soft">No deployments tracked</p> : null}
          </div>
        </section>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-line bg-panel p-4 shadow-panel">
          <MetricRow label="Kafka Events" value="active" />
        </div>
        <div className="rounded-lg border border-line bg-panel p-4 shadow-panel">
          <MetricRow label="RabbitMQ Tasks" value="ready" />
        </div>
        <div className="rounded-lg border border-line bg-panel p-4 shadow-panel">
          <div className="flex items-center justify-between gap-3">
            <MetricRow label="Redis Cache" value="enabled" />
            <Activity className="h-5 w-5 text-white" />
          </div>
        </div>
      </div>

      <GatewayRoutesPanel />
    </div>
  );
}
