import { CheckCircle2, RefreshCw, ShieldAlert, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  fetchIncidents,
  fetchLogs,
  fetchMetricAggregates,
  fetchServices,
  type IncidentRecord,
  type MetricAggregateRecord,
  type ServiceRecord
} from "../../shared/api/core";
import { useWorkspace } from "../../app/workspace";
import { SeverityBadge, StatusBadge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { Card, StatCard } from "../../shared/ui/Card";

type SloRow = {
  service: ServiceRecord;
  availability: number;
  errorBudgetUsed: number;
  p95Latency: number;
  errorLogs: number;
  totalLogs: number;
  openIncidents: number;
};

const numberValue = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : Number(value) || 0);
const pct = (value: number) => `${value.toFixed(2)}%`;

export function SLOsPage() {
  const { environment, fromIso } = useWorkspace();
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [aggregates, setAggregates] = useState<MetricAggregateRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [serviceRows, incidentRows, logRows, aggregateRows] = await Promise.all([
        fetchServices(),
        fetchIncidents(),
        fetchLogs({ environment, from: fromIso, limit: 1000 }),
        fetchMetricAggregates({ environment, from: fromIso, limit: 1000 })
      ]);
      setServices(serviceRows.filter((service) => service.environment === environment));
      setIncidents(incidentRows);
      setLogs(logRows);
      setAggregates(aggregateRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load SLO data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [environment, fromIso]);

  const rows = useMemo<SloRow[]>(
    () =>
      services.map((service) => {
        const serviceLogs = logs.filter((log) => log.serviceId === service.id || log.serviceName === service.name);
        const errorLogs = serviceLogs.filter(
          (log) => numberValue(log.statusCode) >= 500 || ["error", "fatal"].includes(String(log.level).toLowerCase())
        ).length;
        const serviceAggregates = aggregates.filter((item) => item.serviceId === service.id || item.serviceName === service.name);
        const p95Latency = Math.max(0, ...serviceAggregates.map((item) => numberValue(item.p95)));
        const totalLogs = serviceLogs.length;
        const observedAvailability = totalLogs
          ? Math.max(0, (1 - errorLogs / totalLogs) * 100)
          : service.healthStatus === "healthy"
            ? 100
            : service.healthStatus === "degraded"
              ? 99
              : 0;
        const openIncidents = incidents.filter(
          (incident) => incident.serviceId === service.id && !["resolved", "closed"].includes(incident.status)
        ).length;
        return {
          service,
          availability: observedAvailability,
          errorBudgetUsed: Math.min(100, Math.max(0, ((100 - observedAvailability) / 0.1) * 100)),
          p95Latency,
          errorLogs,
          totalLogs,
          openIncidents
        };
      }),
    [aggregates, incidents, logs, services]
  );

  const availabilityBreaches = rows.filter((row) => row.availability < 99.9).length;
  const latencyBreaches = rows.filter((row) => row.p95Latency > 500).length;
  const averageAvailability = rows.length ? rows.reduce((sum, row) => sum + row.availability, 0) / rows.length : 0;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">SLOs</h2>
          <p className="mt-1 text-sm text-text-soft">Service-level objective tracking from logs, metric aggregates, and incident state.</p>
        </div>
        <Button icon={<RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />} disabled={loading} onClick={load}>
          Refresh
        </Button>
      </div>
      {error ? <div className="rounded-2xl border border-rose/40 bg-rose/10 p-3 text-sm text-rose">{error}</div> : null}

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard
          label="Avg availability"
          value={rows.length ? pct(averageAvailability) : "0%"}
          detail={`target 99.90% in ${environment}`}
        />
        <StatCard label="Availability breaches" value={availabilityBreaches} detail="services below target" />
        <StatCard label="Latency breaches" value={latencyBreaches} detail="p95 above 500ms" />
        <StatCard label="Open incidents" value={rows.reduce((sum, row) => sum + row.openIncidents, 0)} detail="service scoped" />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <ObjectiveCard
          icon={<Target className="h-5 w-5 text-white" />}
          title="Availability"
          target="99.90%"
          value={pct(averageAvailability)}
          breached={availabilityBreaches > 0}
        />
        <ObjectiveCard
          icon={<CheckCircle2 className="h-5 w-5 text-amber" />}
          title="Latency"
          target="p95 under 500ms"
          value={`${latencyBreaches} breach${latencyBreaches === 1 ? "" : "es"}`}
          breached={latencyBreaches > 0}
        />
        <ObjectiveCard
          icon={<ShieldAlert className="h-5 w-5 text-rose" />}
          title="Error Budget"
          target="0.10% monthly"
          value={`${rows.filter((row) => row.errorBudgetUsed >= 100).length} exhausted`}
          breached={rows.some((row) => row.errorBudgetUsed >= 100)}
        />
      </div>

      <Card title="Service Objectives" description={`Observed since ${new Date(fromIso).toLocaleString()}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase text-text-muted">
              <tr>
                <th className="py-3 pr-4">Service</th>
                <th className="py-3 pr-4">Health</th>
                <th className="py-3 pr-4">Availability</th>
                <th className="py-3 pr-4">Budget Used</th>
                <th className="py-3 pr-4">P95</th>
                <th className="py-3 pr-4">Errors</th>
                <th className="py-3">Incidents</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40">
              {rows.map((row) => (
                <tr key={row.service.id}>
                  <td className="py-3 pr-4 font-medium text-white">{row.service.name}</td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={row.service.healthStatus} />
                  </td>
                  <td className="py-3 pr-4 text-text-primary">{pct(row.availability)}</td>
                  <td className="py-3 pr-4 text-text-soft">{pct(row.errorBudgetUsed)}</td>
                  <td className="py-3 pr-4 text-text-soft">{Math.round(row.p95Latency)}ms</td>
                  <td className="py-3 pr-4 text-text-soft">
                    {row.errorLogs}/{row.totalLogs}
                  </td>
                  <td className="py-3">{row.openIncidents > 0 ? <SeverityBadge severity="high" /> : <StatusBadge status="healthy" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? <p className="py-8 text-sm text-text-muted">No services found for the selected environment.</p> : null}
        </div>
      </Card>
    </div>
  );
}

function ObjectiveCard({
  icon,
  title,
  target,
  value,
  breached
}: {
  icon: React.ReactNode;
  title: string;
  target: string;
  value: string;
  breached: boolean;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-1 text-xs text-text-muted">Target: {target}</p>
          <p className="mt-4 text-2xl font-semibold text-white">{value}</p>
        </div>
        {icon}
      </div>
      <div
        className={`mt-4 rounded-full border px-3 py-2 text-xs font-semibold ${breached ? "border-rose/40 bg-rose/10 text-rose" : "border-success/40 bg-success/10 text-success"}`}
      >
        {breached ? "Needs attention" : "Within objective"}
      </div>
    </Card>
  );
}
