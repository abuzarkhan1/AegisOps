import { Search, RefreshCw } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { fetchLogs, fetchOrganizations, fetchProjects, fetchServices } from "../../shared/api/core";
import { DataTable, type DataTableColumn } from "../../shared/table/DataTable";
import { Button } from "../../shared/ui/Button";
import { DetailDrawerSkeleton } from "../../shared/ui/LoadingSkeleton";
import { LogLevelBadge, LogLine } from "../../shared/ui/LogPrimitives";

const LogDetailDrawer = lazy(() => import("./LogDetailDrawer").then((module) => ({ default: module.LogDetailDrawer })));

export function LogsPage({ onNavigate }: { onNavigate?: (label: string) => void }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [organizationFilter, setOrganizationFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [envFilter, setEnvFilter] = useState("");
  const [traceFilter, setTraceFilter] = useState("");
  const [requestFilter, setRequestFilter] = useState("");
  const [routeFilter, setRouteFilter] = useState("");
  const [statusCodeFilter, setStatusCodeFilter] = useState("");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [limit, setLimit] = useState(100);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const columns = useMemo<Array<DataTableColumn<any>>>(
    () => [
      {
        key: "timestamp",
        header: "Timestamp",
        sortable: true,
        className: "whitespace-nowrap font-mono text-xs text-text-muted",
        render: (log) => new Date(log.timestamp).toLocaleTimeString()
      },
      {
        key: "service",
        header: "Service",
        sortable: true,
        className: "whitespace-nowrap text-xs font-semibold text-text-primary",
        render: (log) => log.serviceName || "-"
      },
      {
        key: "level",
        header: "Level",
        sortable: true,
        className: "whitespace-nowrap",
        render: (log) => <LogLevelBadge level={log.level} />
      },
      {
        key: "message",
        header: "Message",
        className: "min-w-[24rem] max-w-[38rem]",
        render: (log) => <LogLine className="truncate">{log.message || "-"}</LogLine>
      },
      {
        key: "request",
        header: "Request",
        className: "whitespace-nowrap font-mono text-xs text-text-muted",
        render: (log) => log.requestId || log.traceId || "-"
      },
      {
        key: "route",
        header: "Route",
        className: "whitespace-nowrap font-mono text-xs text-text-muted",
        render: (log) => log.route || log.metadata?.route || "-"
      },
      {
        key: "status",
        header: "Status",
        sortable: true,
        className: "whitespace-nowrap font-mono text-xs text-text-muted",
        render: (log) => log.statusCode || log.metadata?.statusCode || "-"
      }
    ],
    []
  );

  useEffect(() => {
    Promise.all([fetchOrganizations(), fetchProjects(), fetchServices()])
      .then(([orgRows, projectRows, serviceRows]) => {
        setOrganizations(orgRows);
        setProjects(projectRows);
        setServices(serviceRows);
      })
      .catch(() => undefined);
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const results = await fetchLogs({
        organizationId: organizationFilter,
        projectId: projectFilter,
        serviceId: serviceFilter,
        level: levelFilter,
        environment: envFilter,
        traceId: traceFilter,
        requestId: requestFilter,
        route: routeFilter,
        statusCode: statusCodeFilter,
        from: fromFilter ? new Date(fromFilter).toISOString() : "",
        to: toFilter ? new Date(toFilter).toISOString() : "",
        search: searchFilter,
        limit
      });
      setLogs(results);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [organizationFilter, projectFilter, serviceFilter, levelFilter, envFilter, limit]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
      <div className="aegis-glass rounded-2xl p-6 shadow-panel">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Logs Explorer</h2>
            <p className="text-sm text-text-soft">Search and filter logs from application services</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadLogs}
              disabled={loading}
              className="flex h-10 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-text-soft hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-10">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-text-soft">Organization</label>
            <select
              value={organizationFilter}
              onChange={(e) => setOrganizationFilter(e.target.value)}
              className="h-10 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-text-primary outline-none"
            >
              <option value="">All orgs</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-text-soft">Project</label>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="h-10 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-text-primary outline-none"
            >
              <option value="">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-text-soft">Service</label>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="h-10 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-text-primary outline-none"
            >
              <option value="">All Services</option>
              {services.map((svc) => (
                <option key={svc.id} value={svc.id}>
                  {svc.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-text-soft">Level</label>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="h-10 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-text-primary outline-none"
            >
              <option value="">All Levels</option>
              <option value="debug">debug</option>
              <option value="info">info</option>
              <option value="warn">warn</option>
              <option value="error">error</option>
              <option value="fatal">fatal</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-text-soft">Environment</label>
            <select
              value={envFilter}
              onChange={(e) => setEnvFilter(e.target.value)}
              className="h-10 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-text-primary outline-none"
            >
              <option value="">All Envs</option>
              <option value="dev">dev</option>
              <option value="staging">staging</option>
              <option value="production">production</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-text-soft">Trace ID</label>
            <input
              type="text"
              placeholder="e.g. req_abc"
              value={traceFilter}
              onChange={(e) => setTraceFilter(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadLogs()}
              className="h-10 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-text-primary outline-none placeholder:text-text-muted"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-text-soft">Request ID</label>
            <input
              type="text"
              placeholder="req_abc"
              value={requestFilter}
              onChange={(e) => setRequestFilter(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadLogs()}
              className="h-10 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-text-primary outline-none placeholder:text-text-muted"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-text-soft">Route</label>
            <input
              type="text"
              placeholder="/api/checkout"
              value={routeFilter}
              onChange={(e) => setRouteFilter(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadLogs()}
              className="h-10 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-text-primary outline-none placeholder:text-text-muted"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-text-soft">Status</label>
            <input
              type="number"
              placeholder="500"
              value={statusCodeFilter}
              onChange={(e) => setStatusCodeFilter(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadLogs()}
              className="h-10 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-text-primary outline-none placeholder:text-text-muted"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-text-soft">From</label>
            <input
              type="datetime-local"
              value={fromFilter}
              onChange={(e) => setFromFilter(e.target.value)}
              className="h-10 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-text-primary outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-text-soft">To</label>
            <input
              type="datetime-local"
              value={toFilter}
              onChange={(e) => setToFilter(e.target.value)}
              className="h-10 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-text-primary outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-text-soft">Limit</label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="h-10 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-text-primary outline-none"
            >
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
              <option value={200}>200 rows</option>
              <option value={500}>500 rows</option>
            </select>
          </div>
        </div>

        {/* Text Search */}
        <div className="mb-6 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-text-soft" />
            <input
              type="text"
              placeholder="Search in log message..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadLogs()}
              className="h-10 w-full rounded-2xl border border-white/10 bg-white/5 pl-10 pr-3 text-sm text-text-primary outline-none placeholder:text-text-muted"
            />
          </div>
          <button
            onClick={loadLogs}
            className="flex h-10 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-black transition hover:bg-opacity-90"
          >
            Search
          </button>
        </div>

        <DataTable
          rows={logs}
          columns={columns}
          loading={loading}
          emptyTitle="No logs received yet"
          emptyDescription="Install an SDK or send a test log to start searching your application logs. Trace ID links logs and metrics from the same request or operation."
          emptyAction={
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" size="sm" onClick={() => onNavigate?.("Connect Project")}>
                View integration guide
              </Button>
              <Button size="sm" onClick={() => onNavigate?.("Connect Project")}>
                Send test log
              </Button>
            </div>
          }
          onRowClick={setSelectedLog}
          getRowLabel={(log) => `Open log details for ${log.serviceName || "service"} ${log.requestId || log.traceId || ""}`.trim()}
        />
      </div>

      {selectedLog && (
        <Suspense fallback={<DetailDrawerSkeleton className="h-[720px] w-full lg:w-96" />}>
          <LogDetailDrawer log={selectedLog} onClose={() => setSelectedLog(null)} />
        </Suspense>
      )}
    </div>
  );
}
