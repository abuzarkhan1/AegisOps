import { BarChart3, Bot, Download, FileText, RefreshCw, Route, Send, ShieldCheck, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  fetchOrganizations,
  fetchProjects,
  fetchReports,
  fetchServices,
  generateReport,
  type OrganizationRecord,
  type ProjectRecord,
  type ReportRecord,
  type ServiceRecord
} from "../../shared/api/core";

const reportTypes = [
  { value: "weekly_reliability", label: "Weekly Reliability" },
  { value: "daily_reliability", label: "Daily Reliability" },
  { value: "incident_report", label: "Incident Report" },
  { value: "sla_report", label: "SLA Report" },
  { value: "service_health", label: "Service Health" },
  { value: "deployment_impact", label: "Deployment Impact" },
  { value: "ai_postmortem", label: "AI Postmortem" },
  { value: "project_monitoring", label: "Project Monitoring" }
];

const numberValue = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);
const formatNumber = (value: unknown, suffix = "") => `${Math.round(numberValue(value)).toLocaleString()}${suffix}`;
const formatPercent = (value: unknown) => `${numberValue(value).toFixed(1)}%`;
const formatDate = (value?: string) => (value ? new Date(value).toLocaleString() : "No date");
const safeFilename = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "report";

export function ReportsPage() {
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [selectedReportId, setSelectedReportId] = useState("");
  const [filters, setFilters] = useState({
    organizationId: "",
    projectId: "",
    serviceId: "",
    environment: "",
    reportType: "weekly_reliability",
    periodDays: "7"
  });
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedReport = reports.find((report) => report.id === selectedReportId) ?? reports[0];
  const payload = selectedReport?.payload ?? {};
  const summary = payload.summary ?? {};
  const incidentSummary = payload.incidentSummary ?? {};
  const telemetrySummary = payload.telemetrySummary ?? {};
  const logSummary = payload.logSummary ?? {};
  const deploymentSummary = payload.deploymentSummary ?? {};
  const topRoutes = payload.topSlowRoutes ?? [];
  const topServices = payload.topErroringServices ?? [];
  const aiRecommendations = payload.aiRecommendations ?? [];
  const recommendations = payload.recommendations ?? [];

  const filteredServices = useMemo(
    () => services.filter((service) => !filters.projectId || service.projectId === filters.projectId),
    [services, filters.projectId]
  );

  async function loadReports() {
    setLoading(true);
    try {
      const rows = await fetchReports({
        organizationId: filters.organizationId,
        projectId: filters.projectId,
        serviceId: filters.serviceId,
        reportType: filters.reportType,
        limit: 25
      });
      setReports(rows);
      if (!selectedReportId && rows[0]) setSelectedReportId(rows[0].id);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load reports");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    Promise.all([fetchOrganizations(), fetchProjects(), fetchServices()])
      .then(([orgRows, projectRows, serviceRows]) => {
        setOrganizations(orgRows);
        setProjects(projectRows);
        setServices(serviceRows);
        setFilters((current) => ({ ...current, organizationId: current.organizationId || orgRows[0]?.id || "" }));
      })
      .catch((error) => setStatus(error instanceof Error ? error.message : "Unable to load report filters"));
  }, []);

  useEffect(() => {
    if (filters.organizationId) void loadReports();
  }, [filters.organizationId, filters.projectId, filters.serviceId, filters.reportType]);

  async function submitReport() {
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - Number(filters.periodDays) * 24 * 60 * 60 * 1000);
    setLoading(true);
    setStatus("Generating report");
    try {
      const { report } = await generateReport({
        organizationId: filters.organizationId,
        projectId: filters.projectId,
        serviceId: filters.serviceId,
        environment: filters.environment,
        reportType: filters.reportType,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString()
      });
      setReports((current) => [report, ...current.filter((item) => item.id !== report.id)]);
      setSelectedReportId(report.id);
      setStatus("Report generated");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Report generation failed");
    } finally {
      setLoading(false);
    }
  }

  function downloadReport(format: "json" | "csv") {
    if (!selectedReport) return;
    const filename = safeFilename(`${selectedReport.title}-${selectedReport.createdAt}`);
    const content = format === "json" ? JSON.stringify(selectedReport, null, 2) : reportToCsv(selectedReport);
    const blob = new Blob([content], { type: format === "json" ? "application/json" : "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${filename}.${format}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Reliability Reports</h2>
          <p className="text-sm text-slate-400">Generated from incidents, telemetry, deployments, routes, and AI RCA evidence.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            title="Refresh reports"
            onClick={loadReports}
            disabled={loading || !filters.organizationId}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-line bg-panel-soft px-3 text-sm text-slate-300 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            title="Generate report"
            onClick={submitReport}
            disabled={loading || !filters.organizationId}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-mint px-4 text-sm font-semibold text-slate-950 disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            Generate
          </button>
        </div>
      </div>

      <section className="rounded-lg border border-line bg-panel p-4 shadow-panel">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <select className="h-10 rounded-md border border-line bg-panel-soft px-3 text-sm text-slate-200" value={filters.organizationId} onChange={(event) => setFilters((current) => ({ ...current, organizationId: event.target.value }))}>
            <option value="">Organization</option>
            {organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
          </select>
          <select className="h-10 rounded-md border border-line bg-panel-soft px-3 text-sm text-slate-200" value={filters.projectId} onChange={(event) => setFilters((current) => ({ ...current, projectId: event.target.value, serviceId: "" }))}>
            <option value="">All projects</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <select className="h-10 rounded-md border border-line bg-panel-soft px-3 text-sm text-slate-200" value={filters.serviceId} onChange={(event) => setFilters((current) => ({ ...current, serviceId: event.target.value }))}>
            <option value="">All services</option>
            {filteredServices.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
          </select>
          <select className="h-10 rounded-md border border-line bg-panel-soft px-3 text-sm text-slate-200" value={filters.reportType} onChange={(event) => setFilters((current) => ({ ...current, reportType: event.target.value }))}>
            {reportTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
          <select className="h-10 rounded-md border border-line bg-panel-soft px-3 text-sm text-slate-200" value={filters.environment} onChange={(event) => setFilters((current) => ({ ...current, environment: event.target.value }))}>
            <option value="">All envs</option>
            <option value="dev">dev</option>
            <option value="staging">staging</option>
            <option value="production">production</option>
          </select>
          <select className="h-10 rounded-md border border-line bg-panel-soft px-3 text-sm text-slate-200" value={filters.periodDays} onChange={(event) => setFilters((current) => ({ ...current, periodDays: event.target.value }))}>
            <option value="1">1 day</option>
            <option value="7">7 days</option>
            <option value="30">30 days</option>
          </select>
        </div>
        {status ? <p className="mt-3 text-sm text-slate-300">{status}</p> : null}
      </section>

      <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
        <section className="rounded-lg border border-line bg-panel p-4 shadow-panel">
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-5 w-5 text-mint" />
            <h3 className="text-base font-semibold text-white">Generated Reports</h3>
          </div>
          <div className="space-y-2">
            {reports.length === 0 ? (
              <div className="rounded-lg border border-dashed border-line p-4 text-sm text-slate-400">No reports generated for this scope.</div>
            ) : reports.map((report) => (
              <button
                key={report.id}
                type="button"
                onClick={() => setSelectedReportId(report.id)}
                className={`w-full rounded-lg border p-3 text-left transition ${selectedReport?.id === report.id ? "border-mint bg-mint/10" : "border-line bg-panel-soft hover:border-slate-500"}`}
              >
                <p className="text-sm font-semibold text-white">{report.title}</p>
                <p className="mt-1 text-xs text-slate-400">{formatDate(report.createdAt)}</p>
                <p className="mt-1 text-xs text-slate-500">{report.reportType.replace(/_/g, " ")}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-5">
          <div className="rounded-lg border border-line bg-panel p-4 shadow-panel">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">{selectedReport?.title ?? "Report Preview"}</h3>
                <p className="mt-1 text-sm text-slate-400">
                  {selectedReport ? `${formatDate(selectedReport.periodStart)} to ${formatDate(selectedReport.periodEnd)}` : "Generate a report to populate this panel."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  title="Download JSON"
                  disabled={!selectedReport}
                  onClick={() => downloadReport("json")}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-panel-soft px-3 text-xs text-slate-300 disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  JSON
                </button>
                <button
                  type="button"
                  title="Download CSV"
                  disabled={!selectedReport}
                  onClick={() => downloadReport("csv")}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-panel-soft px-3 text-xs text-slate-300 disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  CSV
                </button>
                <button
                  type="button"
                  title="Print report"
                  disabled={!selectedReport}
                  onClick={() => window.print()}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-panel-soft px-3 text-xs text-slate-300 disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  Print
                </button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-line bg-panel-soft p-3">
                <p className="text-xs text-slate-400">Reliability Score</p>
                <p className="mt-1 text-2xl font-semibold text-white">{formatNumber(summary.reliabilityScore)}</p>
              </div>
              <div className="rounded-lg border border-line bg-panel-soft p-3">
                <p className="text-xs text-slate-400">Uptime</p>
                <p className="mt-1 text-2xl font-semibold text-mint">{formatPercent(summary.uptimePercent)}</p>
              </div>
              <div className="rounded-lg border border-line bg-panel-soft p-3">
                <p className="text-xs text-slate-400">Error Rate</p>
                <p className="mt-1 text-2xl font-semibold text-amber">{formatPercent(summary.errorRate)}</p>
              </div>
              <div className="rounded-lg border border-line bg-panel-soft p-3">
                <p className="text-xs text-slate-400">P95 Latency</p>
                <p className="mt-1 text-2xl font-semibold text-white">{formatNumber(summary.p95LatencyMs, "ms")}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-lg border border-line bg-panel p-4 shadow-panel">
              <div className="mb-3 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-mint" />
                <h3 className="text-base font-semibold text-white">Telemetry</h3>
              </div>
              <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                <p>Throughput<br /><span className="font-semibold text-white">{formatNumber(summary.totalThroughput)}</span></p>
                <p>Metrics<br /><span className="font-semibold text-white">{formatNumber(summary.metricsIngested)}</span></p>
                <p>Logs<br /><span className="font-semibold text-white">{formatNumber(summary.logsIngested)}</span></p>
                <p>Error logs<br /><span className="font-semibold text-white">{formatNumber(logSummary.error)}</span></p>
                <p>P99 latency<br /><span className="font-semibold text-white">{formatNumber(summary.p99LatencyMs, "ms")}</span></p>
                <p>Latency samples<br /><span className="font-semibold text-white">{formatNumber(telemetrySummary.latencySamples)}</span></p>
              </div>
            </div>

            <div className="rounded-lg border border-line bg-panel p-4 shadow-panel">
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-mint" />
                <h3 className="text-base font-semibold text-white">Incidents & Deployments</h3>
              </div>
              <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                <p>Total incidents<br /><span className="font-semibold text-white">{formatNumber(incidentSummary.total)}</span></p>
                <p>Open incidents<br /><span className="font-semibold text-white">{formatNumber(incidentSummary.open)}</span></p>
                <p>Critical/high<br /><span className="font-semibold text-white">{formatNumber(numberValue(incidentSummary.critical) + numberValue(incidentSummary.high))}</span></p>
                <p>Avg resolution<br /><span className="font-semibold text-white">{formatNumber(incidentSummary.avgResolutionMinutes, "m")}</span></p>
                <p>Deployments<br /><span className="font-semibold text-white">{formatNumber(deploymentSummary.total)}</span></p>
                <p>Regressions<br /><span className="font-semibold text-white">{formatNumber(deploymentSummary.regressions)}</span></p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-lg border border-line bg-panel p-4 shadow-panel">
              <div className="mb-3 flex items-center gap-2">
                <Route className="h-5 w-5 text-amber" />
                <h3 className="text-base font-semibold text-white">Top Slow Routes</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-line text-slate-400">
                    <tr>
                      <th className="py-2 pr-3">Route</th>
                      <th className="py-2 pr-3">Method</th>
                      <th className="py-2 pr-3">P95</th>
                      <th className="py-2">Errors</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/40">
                    {topRoutes.slice(0, 8).map((route) => (
                      <tr key={`${route.method}-${route.route}`}>
                        <td className="py-2 pr-3 font-mono text-slate-200">{route.route}</td>
                        <td className="py-2 pr-3 text-slate-400">{route.method}</td>
                        <td className="py-2 pr-3 text-slate-300">{Math.round(route.p95Latency)}ms</td>
                        <td className="py-2 text-slate-300">{route.errorCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-lg border border-line bg-panel p-4 shadow-panel">
              <div className="mb-3 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-rose-300" />
                <h3 className="text-base font-semibold text-white">Top Erroring Services</h3>
              </div>
              <div className="space-y-2">
                {topServices.slice(0, 6).map((service) => (
                  <div key={String(service.serviceId)} className="rounded-lg border border-line bg-panel-soft p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-white">{String(service.serviceName ?? "service")}</p>
                      <span className="text-sm text-amber">{formatPercent(service.errorRate)}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">p95 {formatNumber(service.p95LatencyMs, "ms")} / {formatNumber(service.requests)} requests</p>
                  </div>
                ))}
                {topServices.length === 0 ? <p className="text-sm text-slate-400">No service error data for this period.</p> : null}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-line bg-panel p-4 shadow-panel">
            <div className="mb-3 flex items-center gap-2">
              <Bot className="h-5 w-5 text-mint" />
              <h3 className="text-base font-semibold text-white">Recommendations</h3>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                {recommendations.map((item) => (
                  <div key={item} className="rounded-lg border border-line bg-panel-soft p-3 text-sm text-slate-200">{item}</div>
                ))}
              </div>
              <div className="space-y-2">
                {aiRecommendations.slice(0, 3).map((item) => (
                  <div key={String(item.incidentId)} className="rounded-lg border border-line bg-panel-soft p-3">
                    <p className="text-sm font-medium text-white">{String(item.incidentTitle ?? "AI RCA")}</p>
                    <p className="mt-1 text-sm text-slate-400">{String(item.summary ?? "No summary")}</p>
                  </div>
                ))}
                {aiRecommendations.length === 0 ? <p className="text-sm text-slate-400">No AI RCA recommendations in this report period.</p> : null}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function reportToCsv(report: ReportRecord) {
  const rows: string[][] = [
    ["field", "value"],
    ["id", report.id],
    ["title", report.title],
    ["type", report.reportType],
    ["status", report.status],
    ["periodStart", report.periodStart],
    ["periodEnd", report.periodEnd]
  ];
  const summary = report.payload.summary ?? {};
  for (const [key, value] of Object.entries(summary)) rows.push([`summary.${key}`, String(value)]);
  const telemetrySummary = report.payload.telemetrySummary ?? {};
  for (const [key, value] of Object.entries(telemetrySummary)) rows.push([`telemetry.${key}`, String(value)]);
  const incidentSummary = report.payload.incidentSummary ?? {};
  for (const [key, value] of Object.entries(incidentSummary)) rows.push([`incidents.${key}`, String(value)]);
  return rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, "\"\"")}"`).join(",")).join("\n");
}
