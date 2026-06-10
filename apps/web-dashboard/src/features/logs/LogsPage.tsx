import { TerminalSquare, Search, RefreshCw, Layers } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchLogs, fetchServices } from "../../shared/api/core";

const levelColors: Record<string, string> = {
  fatal: "text-rose-500 font-bold border-rose-500/40 bg-rose-500/10",
  error: "text-rose-400 border-rose-400/40 bg-rose-400/10",
  warn: "text-amber-400 border-amber-400/40 bg-amber-400/10",
  info: "text-mint border-mint/40 bg-mint/10",
  debug: "text-slate-400 border-slate-500/40 bg-slate-500/10"
};

export function LogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [serviceFilter, setServiceFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [envFilter, setEnvFilter] = useState("");
  const [traceFilter, setTraceFilter] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [limit, setLimit] = useState(100);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  useEffect(() => {
    fetchServices().then(setServices).catch(() => undefined);
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const results = await fetchLogs({
        serviceName: serviceFilter,
        level: levelFilter,
        environment: envFilter,
        traceId: traceFilter,
        search: searchFilter,
        limit
      });
      setLogs(results);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [serviceFilter, levelFilter, envFilter, limit]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
      <div className="rounded-lg border border-line bg-panel p-6 shadow-panel">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Logs Explorer</h2>
            <p className="text-sm text-slate-400">Search and filter logs from application services</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadLogs}
              disabled={loading}
              className="flex h-10 items-center gap-2 rounded-md border border-line bg-[#0f171d] px-4 text-sm font-medium text-slate-300 hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-400">Service</label>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="h-10 rounded-md border border-line bg-[#0d1419] px-3 text-sm text-slate-200 outline-none"
            >
              <option value="">All Services</option>
              {services.map((svc) => (
                <option key={svc.id} value={svc.name}>
                  {svc.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-400">Level</label>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="h-10 rounded-md border border-line bg-[#0d1419] px-3 text-sm text-slate-200 outline-none"
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
            <label className="text-xs font-semibold text-slate-400">Environment</label>
            <select
              value={envFilter}
              onChange={(e) => setEnvFilter(e.target.value)}
              className="h-10 rounded-md border border-line bg-[#0d1419] px-3 text-sm text-slate-200 outline-none"
            >
              <option value="">All Envs</option>
              <option value="dev">dev</option>
              <option value="staging">staging</option>
              <option value="production">production</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-400">Trace ID</label>
            <input
              type="text"
              placeholder="e.g. req_abc"
              value={traceFilter}
              onChange={(e) => setTraceFilter(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadLogs()}
              className="h-10 rounded-md border border-line bg-[#0d1419] px-3 text-sm text-slate-200 outline-none placeholder:text-slate-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-400">Limit</label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="h-10 rounded-md border border-line bg-[#0d1419] px-3 text-sm text-slate-200 outline-none"
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
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search in log message..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadLogs()}
              className="h-10 w-full rounded-md border border-line bg-[#0d1419] pl-10 pr-3 text-sm text-slate-200 outline-none placeholder:text-slate-500"
            />
          </div>
          <button
            onClick={loadLogs}
            className="flex h-10 items-center justify-center rounded-md bg-mint px-5 text-sm font-semibold text-slate-950 transition hover:bg-opacity-90"
          >
            Search
          </button>
        </div>

        {/* Logs Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line text-xs font-semibold uppercase text-slate-400">
                <th className="py-3 pr-4">Timestamp</th>
                <th className="py-3 pr-4">Service</th>
                <th className="py-3 pr-4">Level</th>
                <th className="py-3 pr-4">Message</th>
                <th className="py-3">Trace ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40 text-xs">
              {logs.map((log) => (
                <tr
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className="cursor-pointer hover:bg-slate-800/40 transition"
                >
                  <td className="py-3 pr-4 whitespace-nowrap text-slate-400">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap font-medium text-slate-300">
                    {log.serviceName}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    <span
                      className={`inline-block rounded border px-2 py-0.5 uppercase text-[10px] ${
                        levelColors[log.level] ?? "text-slate-300 border-line bg-slate-800"
                      }`}
                    >
                      {log.level}
                    </span>
                  </td>
                  <td className="py-3 pr-4 max-w-lg truncate text-slate-300 font-mono">
                    {log.message}
                  </td>
                  <td className="py-3 whitespace-nowrap font-mono text-slate-400">
                    {log.traceId || "-"}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && !loading ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400 font-medium">
                    No logs found. Try adjusting your filter parameters or send synthetic logs.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Detail Panel */}
      {selectedLog && (
        <div className="w-full lg:w-96 rounded-lg border border-line bg-panel p-6 shadow-panel">
          <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
            <h3 className="font-semibold text-white">Log Entry Details</h3>
            <button
              onClick={() => setSelectedLog(null)}
              className="text-slate-400 hover:text-white text-sm"
            >
              Close
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Timestamp</p>
              <p className="text-sm text-slate-200">{new Date(selectedLog.timestamp).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Service Name</p>
              <p className="text-sm text-slate-200 font-semibold">{selectedLog.serviceName}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Environment</p>
              <p className="text-sm text-slate-200">{selectedLog.environment}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Level</p>
              <span
                className={`inline-block rounded border px-2 py-0.5 uppercase text-[10px] mt-1 ${
                  levelColors[selectedLog.level] ?? "text-slate-300 border-line bg-slate-800"
                }`}
              >
                {selectedLog.level}
              </span>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 font-mono">Trace ID</p>
              <p className="text-sm text-slate-200 font-mono">{selectedLog.traceId || "-"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Message</p>
              <div className="rounded border border-line bg-[#0d1419] p-3 text-xs text-rose-300 font-mono break-all whitespace-pre-wrap">
                {selectedLog.message}
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Metadata (JSON)</p>
              <pre className="rounded border border-line bg-[#0d1419] p-3 text-xs text-slate-300 font-mono overflow-auto max-h-60">
                {JSON.stringify(selectedLog.metadata, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
