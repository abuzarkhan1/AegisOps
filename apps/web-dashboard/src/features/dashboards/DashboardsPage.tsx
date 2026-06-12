import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, BarChart3, RefreshCw, Server, TrendingUp } from "lucide-react";
import {
  fetchDashboardSummary,
  fetchDeployments,
  fetchErrorTrends,
  fetchIncidents,
  fetchReports,
  fetchServices,
  type DeploymentRecord,
  type IncidentRecord,
  type ReportRecord,
  type ServiceRecord
} from "../../shared/api/core";
import { useWorkspace } from "../../app/workspace";
import { Button } from "../../shared/ui/Button";
import { Card, StatCard } from "../../shared/ui/Card";
import { SeverityBadge, StatusBadge } from "../../shared/ui/Badge";

const numberValue = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : Number(value) || 0);
const pct = (value: number) => `${Math.round(value * 10) / 10}%`;

export function DashboardsPage() {
  const { environment, timeRangeHours } = useWorkspace();
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [trends, setTrends] = useState<Array<Record<string, number | string>>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [summaryData, trendData, serviceRows, incidentRows, deploymentRows, reportRows] = await Promise.all([
        fetchDashboardSummary(),
        fetchErrorTrends(timeRangeHours),
        fetchServices(),
        fetchIncidents(),
        fetchDeployments(),
        fetchReports({ limit: 8 })
      ]);
      setSummary(summaryData);
      setTrends(trendData);
      setServices(serviceRows.filter((service) => service.environment === environment));
      setIncidents(incidentRows);
      setDeployments(deploymentRows.filter((deployment) => deployment.environment === environment));
      setReports(reportRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboards");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [environment, timeRangeHours]);

  const activeIncidents = incidents.filter((incident) => !["resolved", "closed"].includes(incident.status));
  const serviceHealth = useMemo(() => {
    const total = Math.max(services.length, 1);
    return {
      healthy: services.filter((service) => service.healthStatus === "healthy").length,
      degraded: services.filter((service) => service.healthStatus === "degraded").length,
      down: services.filter((service) => service.healthStatus === "down").length,
      total
    };
  }, [services]);
  const maxTrend = Math.max(1, ...trends.map((item) => numberValue(item.errors ?? item.errorCount ?? item.count)));

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Dashboards</h2>
          <p className="mt-1 text-sm text-text-soft">Live reliability board for {environment} over the active time range.</p>
        </div>
        <Button icon={<RefreshCw className="h-4 w-4" />} disabled={loading} onClick={load}>
          Refresh
        </Button>
      </div>
      {error ? <div className="rounded-2xl border border-rose/40 bg-rose/10 p-3 text-sm text-rose">{error}</div> : null}

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Services" value={services.length} detail={`${pct((serviceHealth.healthy / serviceHealth.total) * 100)} healthy`} />
        <StatCard label="Active incidents" value={activeIncidents.length} detail={`${incidents.length} total incidents`} />
        <StatCard label="Deployments" value={deployments.length} detail={`latest ${deployments[0]?.version ?? "-"}`} />
        <StatCard
          label="Logs ingested"
          value={numberValue(summary.logsIngested ?? summary.logs)}
          detail={`${numberValue(summary.metricsIngested ?? summary.metrics)} metrics`}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Card title="Error Trend" description="Bucketed errors from backend telemetry">
          <div className="flex h-56 items-end gap-2">
            {trends.length === 0 ? <p className="text-sm text-text-muted">No error buckets returned for the selected range.</p> : null}
            {trends.slice(-24).map((bucket, index) => {
              const value = numberValue(bucket.errors ?? bucket.errorCount ?? bucket.count);
              return (
                <div key={`${bucket.bucket ?? index}`} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <div
                    className="w-full rounded-t bg-rose/70"
                    style={{ height: `${Math.max(4, (value / maxTrend) * 180)}px` }}
                    title={`${value} errors`}
                  />
                  <span className="w-full truncate text-center text-[10px] text-text-muted/70">
                    {String(bucket.bucket ?? index).slice(-5)}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Service Health" description="Current health states for selected environment">
          <div className="grid gap-3">
            <HealthRow label="Healthy" value={serviceHealth.healthy} total={serviceHealth.total} className="bg-success" />
            <HealthRow label="Degraded" value={serviceHealth.degraded} total={serviceHealth.total} className="bg-amber" />
            <HealthRow label="Down" value={serviceHealth.down} total={serviceHealth.total} className="bg-rose" />
          </div>
          <div className="mt-4 grid gap-2">
            {services.slice(0, 6).map((service) => (
              <div
                key={service.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
              >
                <span className="truncate text-sm text-white">{service.name}</span>
                <StatusBadge status={service.healthStatus} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card title="Open Issues" description="Incidents requiring attention">
          <div className="grid gap-2">
            {activeIncidents.slice(0, 6).map((incident) => (
              <div key={incident.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-white">{incident.title}</p>
                  <SeverityBadge severity={incident.severity} />
                </div>
                <p className="mt-1 text-xs text-text-muted">{incident.status}</p>
              </div>
            ))}
            {activeIncidents.length === 0 ? <Empty icon={<AlertTriangle className="h-4 w-4" />} text="No active incidents" /> : null}
          </div>
        </Card>

        <Card title="Release Activity" description="Recent deployment records">
          <div className="grid gap-2">
            {deployments.slice(0, 6).map((deployment) => (
              <div key={deployment.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="truncate text-sm font-semibold text-white">{deployment.serviceName}</p>
                <p className="mt-1 text-xs text-text-muted">
                  {deployment.version ?? deployment.commitSha ?? "unversioned"} / {deployment.status ?? "received"}
                </p>
              </div>
            ))}
            {deployments.length === 0 ? <Empty icon={<Server className="h-4 w-4" />} text="No deployments for this environment" /> : null}
          </div>
        </Card>

        <Card title="Reports" description="Generated reliability reports">
          <div className="grid gap-2">
            {reports.slice(0, 6).map((report) => (
              <div key={report.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-white" />
                  <p className="truncate text-sm font-semibold text-white">{report.title}</p>
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  {report.reportType} / {report.status}
                </p>
              </div>
            ))}
            {reports.length === 0 ? <Empty icon={<TrendingUp className="h-4 w-4" />} text="No generated reports yet" /> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}

function HealthRow({ label, value, total, className }: { label: string; value: number; total: number; className: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-text-soft">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-white/5">
        <div className={`h-full ${className}`} style={{ width: `${(value / total) * 100}%` }} />
      </div>
    </div>
  );
}

function Empty({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-muted">
      {icon}
      {text}
    </div>
  );
}
