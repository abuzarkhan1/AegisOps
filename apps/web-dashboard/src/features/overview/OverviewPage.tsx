import { RadioTower, ShieldCheck, Siren, Activity, GitBranch, BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";
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
import { GatewayRoutesPanel } from "./components/GatewayRoutesPanel";
import { SecurityPosturePanel } from "./components/SecurityPosturePanel";
import { ServiceHealthPanel } from "./components/ServiceHealthPanel";

const serviceTargets = [
  { name: "Gateway", icon: ShieldCheck },
  { name: "Core API", icon: RadioTower }
];

export function OverviewPage({ health }: { health: Record<string, HealthResult> }) {
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [trends, setTrends] = useState<Array<Record<string, number | string>>>([]);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);

  useEffect(() => {
    Promise.all([fetchDashboardSummary(), fetchErrorTrends(24), fetchIncidents(), fetchDeployments()])
      .then(([summaryResult, trendResult, incidentResult, deploymentResult]) => {
        setSummary(summaryResult);
        setTrends(trendResult);
        setIncidents(incidentResult.slice(0, 5));
        setDeployments(deploymentResult.slice(0, 5));
      })
      .catch(() => undefined);
  }, []);

  const maxTrend = Math.max(...trends.map((item) => Number(item.incidents ?? 0)), 1);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-lg border border-line bg-panel p-4 shadow-panel">
          <MetricRow label="Services" value={String(summary.servicesMonitored ?? 0)} />
        </div>
        <div className="rounded-lg border border-line bg-panel p-4 shadow-panel">
          <MetricRow label="Healthy" value={String(summary.healthyServices ?? 0)} />
        </div>
        <div className="rounded-lg border border-line bg-panel p-4 shadow-panel">
          <MetricRow label="Degraded" value={String(summary.degradedServices ?? 0)} />
        </div>
        <div className="rounded-lg border border-line bg-panel p-4 shadow-panel">
          <MetricRow label="Down" value={String(summary.downServices ?? 0)} />
        </div>
        <div className="rounded-lg border border-line bg-panel p-4 shadow-panel">
          <MetricRow label="Open Incidents" value={String(summary.openIncidents ?? 0)} />
        </div>
        <div className="rounded-lg border border-line bg-panel p-4 shadow-panel">
          <MetricRow label="Critical" value={String(summary.criticalIncidents ?? 0)} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <ServiceHealthPanel targets={serviceTargets} health={health} />
        <SecurityPosturePanel />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr_1fr]">
        <section className="rounded-lg border border-line bg-panel p-4 shadow-panel">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Error Trend</h2>
            <BarChart3 className="h-5 w-5 text-mint" />
          </div>
          <div className="flex h-36 items-end gap-2 rounded-lg border border-line bg-[#0d1419] p-3">
            {trends.length === 0 ? (
              <p className="self-center text-sm text-slate-400">No incidents in this window</p>
            ) : (
              trends.map((bucket, index) => {
                const value = Number(bucket.incidents ?? 0);
                return (
                  <div key={`${bucket.bucket}-${index}`} className="flex h-full flex-1 items-end">
                    <div
                      title={`${bucket.bucket}: ${value}`}
                      className="w-full rounded-t bg-mint/80"
                      style={{ height: `${Math.max(6, (value / maxTrend) * 100)}%` }}
                    />
                  </div>
                );
              })
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
              <div key={incident.id} className="rounded-lg border border-line bg-[#0d1419] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium text-white">{incident.title}</p>
                  <span className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-300">{incident.severity}</span>
                </div>
                <p className="mt-1 text-xs capitalize text-slate-400">{incident.status}</p>
              </div>
            ))}
            {incidents.length === 0 ? <p className="text-sm text-slate-400">No recent incidents</p> : null}
          </div>
        </section>

        <section className="rounded-lg border border-line bg-panel p-4 shadow-panel">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Recent Deployments</h2>
            <GitBranch className="h-5 w-5 text-sky-400" />
          </div>
          <div className="space-y-3">
            {deployments.map((deployment) => (
              <div key={deployment.id} className="rounded-lg border border-line bg-[#0d1419] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium text-white">{deployment.serviceName}</p>
                  <span className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-300">{deployment.status ?? deployment.provider}</span>
                </div>
                <p className="mt-1 truncate text-xs text-slate-400">{deployment.branch ?? deployment.commitSha ?? deployment.environment}</p>
              </div>
            ))}
            {deployments.length === 0 ? <p className="text-sm text-slate-400">No deployments tracked</p> : null}
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
            <Activity className="h-5 w-5 text-mint" />
          </div>
        </div>
      </div>

      <GatewayRoutesPanel />
    </div>
  );
}
