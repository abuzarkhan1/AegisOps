import { Activity, Gauge, Send } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { fetchDashboardSummary, fetchErrorTrends, fetchServices, ingestMetric, type ServiceRecord } from "../../shared/api/core";
import { MetricRow } from "../../shared/ui/MetricRow";

export function MetricsPage() {
  const [apiKey, setApiKey] = useState("");
  const [value, setValue] = useState(430);
  const [status, setStatus] = useState<string>();
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [trends, setTrends] = useState<Array<Record<string, number | string>>>([]);
  const [services, setServices] = useState<ServiceRecord[]>([]);

  useEffect(() => {
    Promise.all([fetchDashboardSummary(), fetchErrorTrends(24), fetchServices()])
      .then(([summaryResult, trendResult, serviceResult]) => {
        setSummary(summaryResult);
        setTrends(trendResult);
        setServices(serviceResult);
      })
      .catch((error) => setStatus(error instanceof Error ? error.message : "failed to load metrics"));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus("sending");
    try {
      const result = await ingestMetric(apiKey, {
        serviceName: "checkout-api",
        environment: "production",
        metrics: {
          requestCount: 1200,
          errorCount: 31,
          avgLatencyMs: value,
          p95LatencyMs: Math.round(value * 1.65),
          cpuUsage: 61.2,
          memoryUsage: 74.4
        },
        timestamp: new Date().toISOString(),
        labels: { route: "/api/checkout" }
      });
      setStatus(`${result.status} -> ${result.topic}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "failed");
    }
  }

  const maxTrend = Math.max(...trends.map((item) => Number(item.incidents ?? 0)), 1);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-line bg-panel p-4 shadow-panel">
          <MetricRow label="Services" value={String(summary.servicesMonitored ?? services.length)} />
        </div>
        <div className="rounded-lg border border-line bg-panel p-4 shadow-panel">
          <MetricRow label="Open Incidents" value={String(summary.openIncidents ?? 0)} />
        </div>
        <div className="rounded-lg border border-line bg-panel p-4 shadow-panel">
          <MetricRow label="Critical" value={String(summary.criticalIncidents ?? 0)} />
        </div>
        <div className="rounded-lg border border-line bg-panel p-4 shadow-panel">
          <MetricRow label="Alert Rules" value={String(summary.alertRulesEnabled ?? 0)} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="rounded-lg border border-line bg-panel p-5 shadow-panel">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Incident Trend</h2>
            <Activity className="h-5 w-5 text-mint" />
          </div>
          <div className="flex h-56 items-end gap-2 rounded-lg border border-line bg-[#0d1419] p-4">
            {trends.length === 0 ? (
              <p className="self-center text-sm text-slate-400">No trend buckets yet</p>
            ) : (
              trends.map((item, index) => {
                const value = Number(item.incidents ?? 0);
                return (
                  <div key={`${item.bucket}-${index}`} className="flex h-full flex-1 flex-col justify-end gap-2">
                    <div
                      title={`${item.bucket}: ${value}`}
                      className="min-h-1 rounded-t bg-mint/80"
                      style={{ height: `${Math.max(6, (value / maxTrend) * 100)}%` }}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>

        <form onSubmit={submit} className="rounded-lg border border-line bg-panel p-5 shadow-panel">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">Send Metric</h2>
              <p className="text-sm text-slate-400">metrics.received</p>
            </div>
            <Gauge className="h-5 w-5 text-amber" aria-hidden="true" />
          </div>
          <div className="grid gap-3">
            <input className="h-10 rounded-md border border-line bg-[#0d1419] px-3 text-sm" placeholder="API key" value={apiKey} onChange={(event) => setApiKey(event.target.value)} />
            <input className="h-10 rounded-md border border-line bg-[#0d1419] px-3 text-sm" type="number" value={value} onChange={(event) => setValue(Number(event.target.value))} />
            <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-amber px-4 text-sm font-medium text-slate-950" type="submit">
              <Send className="h-4 w-4" />
              Send
            </button>
          </div>
          {status ? <p className="mt-3 text-sm text-slate-300">{status}</p> : null}
        </form>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {services.map((service) => (
          <div key={service.id} className="rounded-lg border border-line bg-[#0d1419] p-4">
            <p className="truncate text-sm font-semibold text-white">{service.name}</p>
            <p className="mt-1 text-xs text-slate-400">{service.healthStatus}</p>
            <div className="mt-3 h-2 rounded bg-slate-800">
              <div className={`h-2 rounded ${service.healthStatus === "healthy" ? "w-full bg-mint" : "w-2/3 bg-amber"}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
