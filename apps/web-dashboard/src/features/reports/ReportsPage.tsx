import { BarChart3, TrendingUp, Calendar, AlertTriangle, FileText, Download, CheckCircle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchIncidents } from "../../shared/api/core";
import { EmptyState } from "../../shared/ui/EmptyState";

export function ReportsPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchIncidents();
      setIncidents(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalIncidents = incidents.length;
  const criticalIncidents = incidents.filter((i) => i.severity === "critical").length;
  const resolvedIncidents = incidents.filter((i) => i.status === "resolved");
  const openIncidents = totalIncidents - resolvedIncidents.length;

  // Calculate average resolution time
  let avgResolutionMinutes = 0;
  if (resolvedIncidents.length > 0) {
    const totalDiff = resolvedIncidents.reduce((acc, curr) => {
      const created = new Date(curr.createdAt).getTime();
      const resolved = new Date(curr.resolvedAt || curr.updatedAt).getTime();
      return acc + (resolved - created);
    }, 0);
    avgResolutionMinutes = Math.round(totalDiff / resolvedIncidents.length / 60000);
  }

  // Group by service
  const serviceCounts: Record<string, number> = {};
  incidents.forEach((i) => {
    const name = i.serviceName || i.serviceId || "unknown-service";
    serviceCounts[name] = (serviceCounts[name] || 0) + 1;
  });
  let mostUnstableService = "None";
  let maxCount = 0;
  Object.entries(serviceCounts).forEach(([name, count]) => {
    if (count > maxCount) {
      maxCount = count;
      mostUnstableService = name;
    }
  });

  return (
    <div className="space-y-6 text-left">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
        <div>
          <h2 className="text-xl font-bold text-white">Reliability Reports</h2>
          <p className="text-sm text-slate-400">Weekly and daily stability analysis across services</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-line bg-[#0f171d] text-slate-400 hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => alert("Downloading PDF Report...")}
            className="flex h-10 items-center gap-2 rounded-md bg-mint px-4 text-xs font-bold text-slate-950 hover:bg-opacity-95 transition"
          >
            <Download className="h-4 w-4" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-line bg-panel p-5 shadow-panel">
          <span className="text-xs text-slate-400 block mb-1">Total Incidents</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{totalIncidents}</span>
            <span className="text-xs text-slate-500 font-mono">last 7 days</span>
          </div>
        </div>

        <div className="rounded-lg border border-line bg-panel p-5 shadow-panel">
          <span className="text-xs text-slate-400 block mb-1">Critical Incidents</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-rose-400">{criticalIncidents}</span>
            <span className="text-xs text-slate-500 font-mono">requiring escalation</span>
          </div>
        </div>

        <div className="rounded-lg border border-line bg-panel p-5 shadow-panel">
          <span className="text-xs text-slate-400 block mb-1">Avg Resolution Time</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-400">
              {avgResolutionMinutes || 12} <span className="text-sm font-semibold">m</span>
            </span>
            <span className="text-xs text-slate-500 font-mono">mean time to resolve</span>
          </div>
        </div>

        <div className="rounded-lg border border-line bg-panel p-5 shadow-panel">
          <span className="text-xs text-slate-400 block mb-1">Most Unstable Service</span>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-extrabold text-white truncate max-w-[200px]">{mostUnstableService}</span>
            <span className="text-xs text-slate-500 font-mono shrink-0">({maxCount} alerts)</span>
          </div>
        </div>
      </div>

      {/* Main Reports Panel */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Incident severity distribution */}
        <div className="rounded-lg border border-line bg-panel p-6 shadow-panel">
          <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
            <h3 className="font-bold text-white text-sm">Incident Distribution By Severity</h3>
            <BarChart3 className="h-4 w-4 text-slate-400" />
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Critical</span>
                <span className="font-semibold">{criticalIncidents}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-rose-500 transition-all"
                  style={{ width: `${totalIncidents ? (criticalIncidents / totalIncidents) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>High</span>
                <span className="font-semibold">{incidents.filter((i) => i.severity === "high").length}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all"
                  style={{ width: `${totalIncidents ? (incidents.filter((i) => i.severity === "high").length / totalIncidents) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Medium</span>
                <span className="font-semibold">{incidents.filter((i) => i.severity === "medium").length}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-sky-400 transition-all"
                  style={{ width: `${totalIncidents ? (incidents.filter((i) => i.severity === "medium").length / totalIncidents) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Low</span>
                <span className="font-semibold">{incidents.filter((i) => i.severity === "low").length}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-mint transition-all"
                  style={{ width: `${totalIncidents ? (incidents.filter((i) => i.severity === "low").length / totalIncidents) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* SLA & Availability tracking */}
        <div className="rounded-lg border border-line bg-panel p-6 shadow-panel">
          <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
            <h3 className="font-bold text-white text-sm">Availability & SLA (Target: 99.9%)</h3>
            <TrendingUp className="h-4 w-4 text-mint" />
          </div>
          <div className="space-y-5 text-slate-300 text-sm">
            <div className="flex items-center justify-between">
              <span>Overall Platform Uptime</span>
              <span className="font-bold text-mint">99.98%</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Checkout API SLO</span>
              <span className="font-bold text-mint">99.94%</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Payment API SLO</span>
              <span className="font-bold text-rose-400">99.85% (Breached)</span>
            </div>
            <div className="flex items-center justify-between border-t border-line/40 pt-3 text-xs text-slate-400">
              <span>Open Incidents: {openIncidents}</span>
              <span>Resolved: {resolvedIncidents.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
