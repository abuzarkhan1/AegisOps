import { Activity, Gauge, Layers, RefreshCw, Send } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  fetchMetricAggregates,
  fetchMetrics,
  fetchOrganizations,
  fetchProjects,
  fetchServices,
  ingestBatchMetrics,
  ingestCustomMetric,
  type MetricAggregateRecord,
  type MetricRecord,
  type OrganizationRecord,
  type ProjectRecord,
  type ServiceRecord
} from "../../shared/api/core";
import { Button } from "../../shared/ui/Button";
import { EmptyState } from "../../shared/ui/EmptyState";
import { MetricRow } from "../../shared/ui/MetricRow";

const throughputMetrics = new Set([
  "http_requests_total",
  "request_count",
  "requestCount",
  "service_events_total",
  "worker_jobs_processed_total"
]);
const errorMetrics = new Set(["http_errors_total", "http_5xx_total", "error_count", "errorCount", "exceptions_total"]);
const latencyMetrics = new Set(["http_request_duration_ms", "http_request_duration_p95", "p95LatencyMs", "p95_latency"]);

const timeRanges = [
  { label: "1h", hours: 1 },
  { label: "6h", hours: 6 },
  { label: "24h", hours: 24 },
  { label: "7d", hours: 24 * 7 }
];

export function MetricsPage({ onNavigate }: { onNavigate?: (label: string) => void }) {
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [metrics, setMetrics] = useState<MetricRecord[]>([]);
  const [aggregates, setAggregates] = useState<MetricAggregateRecord[]>([]);
  const [filters, setFilters] = useState({
    organizationId: "",
    projectId: "",
    serviceId: "",
    environment: "",
    metricName: "",
    timeRange: "24h"
  });
  const [apiKey, setApiKey] = useState("");
  const [metricValue, setMetricValue] = useState(430);
  const [status, setStatus] = useState<string>();
  const [loading, setLoading] = useState(false);

  const selectedService = services.find((service) => service.id === filters.serviceId);
  const selectedProject = projects.find((project) => project.id === filters.projectId);
  const range = timeRanges.find((item) => item.label === filters.timeRange) ?? timeRanges[2];
  const from = new Date(Date.now() - range.hours * 60 * 60 * 1000).toISOString();

  const load = async () => {
    setLoading(true);
    try {
      const params = {
        organizationId: filters.organizationId,
        projectId: filters.projectId,
        serviceId: filters.serviceId,
        environment: filters.environment,
        metricName: filters.metricName,
        from,
        limit: 200
      };
      const [metricRows, aggregateRows] = await Promise.all([
        fetchMetrics(params),
        fetchMetricAggregates({ ...params, window: "1m", limit: 200 })
      ]);
      setMetrics(metricRows);
      setAggregates(aggregateRows);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "failed to load metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.all([fetchOrganizations(), fetchProjects(), fetchServices()])
      .then(([orgRows, projectRows, serviceRows]) => {
        setOrganizations(orgRows);
        setProjects(projectRows);
        setServices(serviceRows);
      })
      .catch((error) => setStatus(error instanceof Error ? error.message : "failed to load filters"));
  }, []);

  useEffect(() => {
    load();
  }, [filters.organizationId, filters.projectId, filters.serviceId, filters.environment, filters.metricName, filters.timeRange]);

  const summary = useMemo(() => {
    const throughput = metrics
      .filter((metric) => throughputMetrics.has(metric.metricName))
      .reduce((total, metric) => total + metric.value, 0);
    const errors = metrics.filter((metric) => errorMetrics.has(metric.metricName)).reduce((total, metric) => total + metric.value, 0);
    const p95 = metrics.filter((metric) => latencyMetrics.has(metric.metricName)).reduce((max, metric) => Math.max(max, metric.value), 0);
    const routeCount = new Set(metrics.map((metric) => String(metric.labels?.route ?? "")).filter(Boolean)).size;
    return {
      throughput,
      errorRate: throughput > 0 ? (errors / throughput) * 100 : 0,
      p95,
      routeCount
    };
  }, [metrics]);

  async function submitCustom(event: FormEvent) {
    event.preventDefault();
    setStatus("sending");
    try {
      const payload = {
        projectKey: selectedProject?.projectKey ?? "loan-tracker",
        serviceName: selectedService?.name ?? "loan-tracker-api",
        serviceId: selectedService?.id,
        environment: filters.environment || selectedService?.environment || selectedProject?.environment || "production",
        metricName: filters.metricName || "http_request_duration_ms",
        value: metricValue,
        timestamp: new Date().toISOString(),
        labels: { route: "/api/transactions", method: "POST", statusCode: "200" }
      };
      const result = await ingestCustomMetric(apiKey, payload);
      setStatus(`${result.status} -> ${result.topic}`);
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "failed");
    }
  }

  async function submitBatch() {
    setStatus("sending batch");
    try {
      const timestamp = new Date().toISOString();
      const payload = {
        projectKey: selectedProject?.projectKey ?? "loan-tracker",
        serviceName: selectedService?.name ?? "loan-tracker-api",
        serviceId: selectedService?.id,
        environment: filters.environment || selectedService?.environment || selectedProject?.environment || "production",
        metrics: [
          {
            metricName: "http_requests_total",
            value: 1,
            timestamp,
            labels: { route: "/api/transactions", method: "POST", statusCode: "200" }
          },
          { metricName: "http_request_duration_ms", value: metricValue, timestamp, labels: { route: "/api/transactions", method: "POST" } },
          { metricName: "http_5xx_total", value: metricValue > 900 ? 1 : 0, timestamp, labels: { route: "/api/transactions" } }
        ]
      };
      const result = await ingestBatchMetrics(apiKey, payload);
      setStatus(`${result.status} -> ${result.topic} (${result.count})`);
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "failed");
    }
  }

  const maxAggregate = Math.max(...aggregates.slice(0, 24).map((item) => item.max), 1);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="aegis-glass rounded-2xl p-4 shadow-panel">
          <MetricRow
            label="Throughput"
            value={String(Math.round(summary.throughput))}
            help="Throughput is the number of requests or events your service handles over time."
          />
        </div>
        <div className="aegis-glass rounded-2xl p-4 shadow-panel">
          <MetricRow
            label="Error Rate"
            value={`${summary.errorRate.toFixed(1)}%`}
            help="Error rate is the percentage of requests that resulted in errors."
          />
        </div>
        <div className="aegis-glass rounded-2xl p-4 shadow-panel">
          <MetricRow
            label="P95 Latency"
            value={`${Math.round(summary.p95)}ms`}
            help="P95 latency means 95% of requests were faster than this value."
          />
        </div>
        <div className="aegis-glass rounded-2xl p-4 shadow-panel">
          <MetricRow label="Routes" value={String(summary.routeCount)} />
        </div>
      </div>

      {!loading && metrics.length === 0 && aggregates.length === 0 ? (
        <EmptyState
          title="No metrics received yet"
          description="AegisOps can track request count, latency, error rate, slow requests, and custom metrics."
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" size="sm" onClick={() => onNavigate?.("Connect Project")}>
                View SDK setup
              </Button>
              <Button size="sm" onClick={() => onNavigate?.("Connect Project")}>
                Send test metric
              </Button>
            </div>
          }
        />
      ) : null}

      <div className="aegis-glass rounded-2xl p-4 shadow-panel">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-white" />
            <h2 className="text-base font-semibold text-white">Metrics Explorer</h2>
          </div>
          <button
            onClick={load}
            className="inline-flex h-9 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-text-soft"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <select
            className="h-10 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm"
            value={filters.organizationId}
            onChange={(event) => setFilters((current) => ({ ...current, organizationId: event.target.value }))}
          >
            <option value="">All organizations</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm"
            value={filters.projectId}
            onChange={(event) => setFilters((current) => ({ ...current, projectId: event.target.value }))}
          >
            <option value="">All projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm"
            value={filters.serviceId}
            onChange={(event) => setFilters((current) => ({ ...current, serviceId: event.target.value }))}
          >
            <option value="">All services</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm"
            value={filters.environment}
            onChange={(event) => setFilters((current) => ({ ...current, environment: event.target.value }))}
          >
            <option value="">All envs</option>
            <option value="dev">dev</option>
            <option value="staging">staging</option>
            <option value="production">production</option>
          </select>
          <input
            className="h-10 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm"
            value={filters.metricName}
            onChange={(event) => setFilters((current) => ({ ...current, metricName: event.target.value }))}
            placeholder="metric name"
          />
          <select
            className="h-10 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm"
            value={filters.timeRange}
            onChange={(event) => setFilters((current) => ({ ...current, timeRange: event.target.value }))}
          >
            {timeRanges.map((item) => (
              <option key={item.label} value={item.label}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="aegis-glass rounded-2xl p-4 shadow-panel">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Aggregate Trend</h2>
            <Layers className="h-5 w-5 text-white" />
          </div>
          <div className="flex h-44 items-end gap-2 aegis-glass rounded-2xl p-3">
            {aggregates.length === 0 ? (
              <p className="self-center text-sm text-text-soft">No aggregate buckets yet</p>
            ) : (
              aggregates
                .slice(0, 48)
                .reverse()
                .map((bucket) => (
                  <div key={bucket.id} className="flex h-full flex-1 items-end">
                    <div
                      className="w-full rounded-t bg-white/80"
                      title={`${bucket.metricName}: ${bucket.max}`}
                      style={{ height: `${Math.max(6, (bucket.max / maxAggregate) * 100)}%` }}
                    />
                  </div>
                ))
            )}
          </div>
        </div>

        <form onSubmit={submitCustom} className="aegis-glass rounded-2xl p-4 shadow-panel">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-white">Send Metric</h2>
            <Gauge className="h-5 w-5 text-amber" />
          </div>
          <div className="grid gap-3">
            <input
              className="h-10 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm"
              placeholder="API key"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
            />
            <input
              className="h-10 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm"
              type="number"
              value={metricValue}
              onChange={(event) => setMetricValue(Number(event.target.value))}
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-amber px-3 text-sm font-medium text-black"
                type="submit"
              >
                <Send className="h-4 w-4" />
                Custom
              </button>
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm font-medium text-white"
                type="button"
                onClick={submitBatch}
              >
                <Layers className="h-4 w-4" />
                Batch
              </button>
            </div>
          </div>
          {status ? <p className="mt-3 break-words text-sm text-text-soft">{status}</p> : null}
        </form>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="aegis-glass rounded-2xl p-4 shadow-panel">
          <h2 className="mb-3 text-base font-semibold text-white">Aggregate Metrics</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 text-text-soft">
                <tr>
                  <th className="py-2 pr-3">Metric</th>
                  <th className="py-2 pr-3">Window</th>
                  <th className="py-2 pr-3">Avg</th>
                  <th className="py-2 pr-3">P95</th>
                  <th className="py-2">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40">
                {aggregates.slice(0, 12).map((bucket) => (
                  <tr key={bucket.id}>
                    <td className="py-2 pr-3 font-mono text-text-primary">{bucket.metricName}</td>
                    <td className="py-2 pr-3 text-text-soft">{bucket.window}</td>
                    <td className="py-2 pr-3 text-text-soft">{bucket.avg.toFixed(1)}</td>
                    <td className="py-2 pr-3 text-text-soft">{bucket.p95.toFixed(1)}</td>
                    <td className="py-2 text-text-soft">{bucket.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="aegis-glass rounded-2xl p-4 shadow-panel">
          <h2 className="mb-3 text-base font-semibold text-white">Raw Metrics</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 text-text-soft">
                <tr>
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3">Service</th>
                  <th className="py-2 pr-3">Metric</th>
                  <th className="py-2">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40">
                {metrics.slice(0, 14).map((metric) => (
                  <tr key={metric.id}>
                    <td className="py-2 pr-3 whitespace-nowrap text-text-soft">{new Date(metric.timestamp).toLocaleTimeString()}</td>
                    <td className="py-2 pr-3 text-text-soft">{metric.serviceName}</td>
                    <td className="py-2 pr-3 font-mono text-text-primary">{metric.metricName}</td>
                    <td className="py-2 text-text-soft">{metric.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
