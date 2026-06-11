import { Filter, History, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { fetchAuditLogs, fetchOrganizations } from "../../shared/api/core";
import type { AuditLogRecord, OrganizationRecord } from "../../shared/api/core";
import { EmptyState } from "../../shared/ui/EmptyState";

const actionTone = (action: string) => {
  if (action.includes("created") || action.includes("generated")) return "border-mint/30 bg-mint/10 text-mint";
  if (action.includes("deleted") || action.includes("revoked") || action.includes("resolved")) return "border-rose-500/30 bg-rose-500/10 text-rose-300";
  if (action.includes("updated") || action.includes("assigned") || action.includes("acknowledged")) return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  return "border-slate-600 bg-panel-hover text-slate-300";
};

const formatDate = (value?: string) => (value ? new Date(value).toLocaleString() : "No timestamp");
const compactId = (value?: string) => (value ? `${value.slice(0, 8)}...${value.slice(-4)}` : "none");
const metadataPreview = (metadata: Record<string, unknown>) => JSON.stringify(metadata ?? {}, null, 2);

export function AuditLogsPage() {
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [selectedLogId, setSelectedLogId] = useState("");
  const [filters, setFilters] = useState({
    organizationId: "",
    actorId: "",
    action: "",
    resourceType: "",
    status: "",
    from: "",
    to: "",
    limit: "100"
  });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const selectedLog = logs.find((item) => item.id === selectedLogId) ?? logs[0];
  const actionCount = useMemo(() => new Set(logs.map((item) => item.action)).size, [logs]);
  const resourceCount = useMemo(() => new Set(logs.map((item) => item.resourceType)).size, [logs]);
  const actorCount = useMemo(() => new Set(logs.map((item) => item.actorId).filter(Boolean)).size, [logs]);

  async function load(nextFilters = filters) {
    setLoading(true);
    try {
      const rows = await fetchAuditLogs({
        organizationId: nextFilters.organizationId,
        actorId: nextFilters.actorId,
        action: nextFilters.action,
        resourceType: nextFilters.resourceType,
        status: nextFilters.status,
        from: nextFilters.from,
        to: nextFilters.to,
        limit: nextFilters.limit
      });
      setLogs(rows);
      setSelectedLogId((current) => (rows.some((item) => item.id === current) ? current : rows[0]?.id ?? ""));
      setStatus(rows.length ? `${rows.length} audit events loaded` : "No audit events match these filters");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function boot() {
      const orgs = await fetchOrganizations();
      setOrganizations(orgs);
      const organizationId = orgs[0]?.id ?? "";
      const nextFilters = { ...filters, organizationId };
      setFilters(nextFilters);
      await load(nextFilters);
    }
    boot().catch((error) => setStatus(error instanceof Error ? error.message : "Failed to load audit logs"));
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    void load();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <aside className="space-y-4">
        <form onSubmit={submit} className="rounded-lg border border-line bg-panel p-5 shadow-panel">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">Audit Logs</h2>
              <p className="text-xs text-slate-400">Enterprise action trail</p>
            </div>
            <History className="h-5 w-5 text-mint" />
          </div>

          <div className="grid gap-3">
            <label className="text-xs font-semibold uppercase text-slate-400">
              Organization
              <select
                value={filters.organizationId}
                onChange={(event) => setFilters((current) => ({ ...current, organizationId: event.target.value }))}
                className="mt-1 h-10 w-full rounded-md border border-line bg-panel-soft px-3 text-sm normal-case text-white"
              >
                <option value="">All organizations</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold uppercase text-slate-400">
              Actor ID
              <input
                value={filters.actorId}
                onChange={(event) => setFilters((current) => ({ ...current, actorId: event.target.value }))}
                className="mt-1 h-10 w-full rounded-md border border-line bg-panel-soft px-3 text-sm normal-case text-white"
                placeholder="user uuid"
              />
            </label>
            <label className="text-xs font-semibold uppercase text-slate-400">
              Action
              <input
                value={filters.action}
                onChange={(event) => setFilters((current) => ({ ...current, action: event.target.value }))}
                className="mt-1 h-10 w-full rounded-md border border-line bg-panel-soft px-3 text-sm normal-case text-white"
                placeholder="incident.resolved"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold uppercase text-slate-400">
                Resource
                <select
                  value={filters.resourceType}
                  onChange={(event) => setFilters((current) => ({ ...current, resourceType: event.target.value }))}
                  className="mt-1 h-10 w-full rounded-md border border-line bg-panel-soft px-3 text-sm normal-case text-white"
                >
                  <option value="">All</option>
                  <option value="organization">organization</option>
                  <option value="project">project</option>
                  <option value="service">service</option>
                  <option value="api_key">api_key</option>
                  <option value="alert_rule">alert_rule</option>
                  <option value="incident">incident</option>
                  <option value="user">user</option>
                </select>
              </label>
              <label className="text-xs font-semibold uppercase text-slate-400">
                Status
                <select
                  value={filters.status}
                  onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
                  className="mt-1 h-10 w-full rounded-md border border-line bg-panel-soft px-3 text-sm normal-case text-white"
                >
                  <option value="">Any</option>
                  <option value="recorded">recorded</option>
                  <option value="accepted">accepted</option>
                  <option value="success">success</option>
                  <option value="failed">failed</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold uppercase text-slate-400">
                From
                <input
                  type="datetime-local"
                  value={filters.from}
                  onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
                  className="mt-1 h-10 w-full rounded-md border border-line bg-panel-soft px-3 text-sm normal-case text-white"
                />
              </label>
              <label className="text-xs font-semibold uppercase text-slate-400">
                To
                <input
                  type="datetime-local"
                  value={filters.to}
                  onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
                  className="mt-1 h-10 w-full rounded-md border border-line bg-panel-soft px-3 text-sm normal-case text-white"
                />
              </label>
            </div>
            <label className="text-xs font-semibold uppercase text-slate-400">
              Limit
              <input
                type="number"
                min="1"
                max="500"
                value={filters.limit}
                onChange={(event) => setFilters((current) => ({ ...current, limit: event.target.value }))}
                className="mt-1 h-10 w-full rounded-md border border-line bg-panel-soft px-3 text-sm normal-case text-white"
              />
            </label>
            <button type="submit" disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-mint px-4 text-sm font-semibold text-slate-950 disabled:opacity-50">
              <Filter className="h-4 w-4" />
              {loading ? "Loading..." : "Apply Filters"}
            </button>
          </div>
          {status ? <p className="mt-3 text-sm text-slate-300">{status}</p> : null}
        </form>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-line bg-panel p-3 shadow-panel">
            <p className="text-xs uppercase text-slate-400">Events</p>
            <p className="mt-1 text-xl font-bold text-white">{logs.length}</p>
          </div>
          <div className="rounded-lg border border-line bg-panel p-3 shadow-panel">
            <p className="text-xs uppercase text-slate-400">Actions</p>
            <p className="mt-1 text-xl font-bold text-white">{actionCount}</p>
          </div>
          <div className="rounded-lg border border-line bg-panel p-3 shadow-panel">
            <p className="text-xs uppercase text-slate-400">Actors</p>
            <p className="mt-1 text-xl font-bold text-white">{actorCount}</p>
          </div>
        </div>
      </aside>

      <main className="space-y-4">
        <section className="rounded-lg border border-line bg-panel p-5 shadow-panel">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-white">Action Stream</h3>
              <p className="text-xs text-slate-400">Newest recorded actions first</p>
            </div>
            <button type="button" onClick={() => load()} disabled={loading} title="Refresh audit logs" className="grid h-9 w-9 place-items-center rounded-md border border-line bg-panel-soft text-slate-300 hover:text-white disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {logs.length === 0 ? <EmptyState title="No audit logs found" /> : null}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-3 pr-4">Timestamp</th>
                  <th className="py-3 pr-4">Action</th>
                  <th className="py-3 pr-4">Resource</th>
                  <th className="py-3 pr-4">Actor</th>
                  <th className="py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLogId(log.id)}
                    className={`cursor-pointer transition hover:bg-panel-soft/60 ${selectedLog?.id === log.id ? "bg-mint/5" : ""}`}
                  >
                    <td className="py-3 pr-4 text-xs text-slate-400">{formatDate(log.createdAt)}</td>
                    <td className="py-3 pr-4">
                      <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${actionTone(log.action)}`}>{log.action}</span>
                    </td>
                    <td className="py-3 pr-4 text-slate-300">
                      <div className="font-medium text-white">{log.resourceType}</div>
                      <div className="font-mono text-xs text-slate-500">{compactId(log.resourceId)}</div>
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-slate-400">{compactId(log.actorId)}</td>
                    <td className="py-3">
                      <span className="rounded-md border border-line bg-panel-soft px-2 py-1 text-xs text-slate-300">{log.status ?? "recorded"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-panel p-5 shadow-panel">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-mint" />
            <h3 className="text-base font-semibold text-white">Event Detail</h3>
          </div>
          {selectedLog ? (
            <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
              <div className="space-y-3 text-sm">
                <p><span className="block text-xs uppercase text-slate-500">Audit ID</span><span className="font-mono text-slate-200">{selectedLog.id}</span></p>
                <p><span className="block text-xs uppercase text-slate-500">Organization</span><span className="font-mono text-slate-200">{selectedLog.organizationId ?? "none"}</span></p>
                <p><span className="block text-xs uppercase text-slate-500">Actor</span><span className="font-mono text-slate-200">{selectedLog.actorId ?? "system"}</span></p>
                <p><span className="block text-xs uppercase text-slate-500">IP Address</span><span className="font-mono text-slate-200">{selectedLog.ipAddress ?? "not captured"}</span></p>
              </div>
              <pre className="max-h-72 overflow-auto rounded-lg border border-line bg-panel-soft p-4 text-xs leading-5 text-slate-300">
                {metadataPreview(selectedLog.metadata)}
              </pre>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-line p-4 text-sm text-slate-400">
              <Search className="h-4 w-4" />
              Select an audit event to inspect metadata.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
