import { GitBranch, Clock, ArrowRight, CheckCircle2, AlertTriangle, RefreshCw, BarChart, ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchDeployments, fetchDeploymentImpact } from "../../shared/api/core";
import type { DeploymentRecord } from "../../shared/api/core";
import { EmptyState } from "../../shared/ui/EmptyState";

const riskColors: Record<string, string> = {
  high: "border-rose-500/40 bg-rose-500/10 text-rose-400 font-bold",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-400 font-medium",
  low: "border-mint/40 bg-mint/10 text-mint"
};

export function DeploymentsPage() {
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);
  const [selectedDeployment, setSelectedDeployment] = useState<DeploymentRecord | null>(null);
  const [impact, setImpact] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [error, setError] = useState<string>();

  const loadDeployments = async () => {
    setLoading(true);
    try {
      const data = await fetchDeployments();
      setDeployments(data);
      if (data.length > 0 && !selectedDeployment) {
        setSelectedDeployment(data[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load deployments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeployments();
  }, []);

  const loadImpact = async (deploymentId: string) => {
    setLoadingImpact(true);
    try {
      const result = await fetchDeploymentImpact(deploymentId);
      setImpact(result);
    } catch {
      setImpact(null);
    } finally {
      setLoadingImpact(false);
    }
  };

  useEffect(() => {
    if (selectedDeployment) {
      loadImpact(selectedDeployment.id);
    }
  }, [selectedDeployment?.id]);

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      {/* Deployments Sidebar */}
      <div className="rounded-lg border border-line bg-panel p-5 shadow-panel flex flex-col h-[750px]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Deployments</h2>
            <p className="text-xs text-slate-400">Webhook-tracked pipeline releases</p>
          </div>
          <button
            onClick={loadDeployments}
            disabled={loading}
            className="p-2 rounded-md hover:bg-panel-hover text-slate-400 hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {error ? <p className="text-sm text-rose-400 mb-2">{error}</p> : null}

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {deployments.map((dep) => {
            const active = selectedDeployment?.id === dep.id;
            return (
              <div
                key={dep.id}
                onClick={() => setSelectedDeployment(dep)}
                className={`cursor-pointer rounded-lg border p-4 transition text-left ${
                  active
                    ? "border-mint/50 bg-mint/10"
                    : "border-line bg-panel-soft hover:border-line hover:bg-panel-hover"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-white">{dep.serviceName}</p>
                  <span className="rounded bg-panel-hover border border-line px-1.5 py-0.5 text-[10px] font-mono shrink-0 text-slate-300">
                    {dep.version || "v?"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-1">Commit: {dep.commitSha?.slice(0, 7) || "None"}</p>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span className="capitalize">{dep.provider}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(dep.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            );
          })}
          {deployments.length === 0 && !loading ? (
            <EmptyState title="No deployments tracked yet" />
          ) : null}
        </div>
      </div>

      {/* Deployment Impact Panel */}
      <div className="flex flex-col h-[750px] overflow-y-auto rounded-lg border border-line bg-panel p-6 shadow-panel">
        {selectedDeployment ? (
          <div className="space-y-6 text-left">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-white">Deployment: {selectedDeployment.serviceName}</h2>
                  <span className="rounded-md border border-line bg-panel-soft px-2.5 py-0.5 text-xs text-slate-300 font-mono">
                    {selectedDeployment.version || "unknown-version"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-400 font-mono">Deployment ID: {selectedDeployment.id}</p>
              </div>

              <div className="flex items-center gap-2">
                <span className="rounded border border-line px-3 py-1.5 bg-panel-soft text-xs font-mono text-slate-400">
                  Env: {selectedDeployment.environment}
                </span>
                <span className="rounded border border-line px-3 py-1.5 bg-panel-soft text-xs text-slate-400">
                  Author: {selectedDeployment.deployedBy || "Webhook"}
                </span>
              </div>
            </div>

            {/* Commit details */}
            <div className="rounded-lg border border-line bg-panel-soft p-4 flex justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <GitBranch className="h-5 w-5 text-mint" />
                <div>
                  <span className="text-xs text-slate-400 uppercase block font-semibold">Repository SHA</span>
                  <span className="text-sm text-slate-200 font-mono">{selectedDeployment.commitSha || "No SHA provided"}</span>
                </div>
              </div>
              <span className="text-xs text-slate-500">{new Date(selectedDeployment.createdAt).toLocaleString()}</span>
            </div>

            {/* AI Deployment Impact Report */}
            <div className="rounded-lg border border-line bg-panel-hover p-6">
              <div className="mb-4 flex items-center gap-2 border-b border-line pb-3">
                <BarChart className="h-5 w-5 text-mint" />
                <h3 className="text-base font-bold text-white">AI Deployment Impact Report</h3>
                {impact && impact.status === "complete" && (
                  <span className={`ml-auto rounded border px-2 py-0.5 text-xs uppercase font-bold ${riskColors[impact.risk] ?? "text-slate-300"}`}>
                    Risk: {impact.risk}
                  </span>
                )}
              </div>

              {loadingImpact ? (
                <div className="py-6 text-center text-slate-400 text-sm">Evaluating metrics...</div>
              ) : impact && impact.status === "complete" ? (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-xs font-bold uppercase text-slate-400 mb-1">Impact Summary</h4>
                    <p className="text-sm leading-relaxed text-slate-200">{impact.summary}</p>
                  </div>

                  {/* Metrics Diff */}
                  <div>
                    <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">Pre vs. Post Deployment Metrics Comparison (30m window)</h4>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded border border-line bg-panel-soft p-4">
                        <span className="text-xs font-bold text-slate-400 block mb-2">API Error Rate</span>
                        <div className="flex items-center justify-between">
                          <div className="text-slate-300 text-xs">Before: <span className="font-semibold">{impact.beforeMetrics?.errorRate}%</span></div>
                          <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
                          <div className="text-rose-400 text-sm font-bold">After: <span>{impact.afterMetrics?.errorRate}%</span></div>
                        </div>
                      </div>

                      <div className="rounded border border-line bg-panel-soft p-4">
                        <span className="text-xs font-bold text-slate-400 block mb-2">Tail Latency (P95)</span>
                        <div className="flex items-center justify-between">
                          <div className="text-slate-300 text-xs">Before: <span className="font-semibold">{impact.beforeMetrics?.p95LatencyMs || impact.beforeMetrics?.avgLatencyMs}ms</span></div>
                          <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
                          <div className="text-amber-400 text-sm font-bold">After: <span>{impact.afterMetrics?.p95LatencyMs || impact.afterMetrics?.avgLatencyMs}ms</span></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div className={`rounded-lg border p-4 flex gap-3 ${impact.risk === "high" ? "border-rose-500/20 bg-rose-500/5 text-rose-300" : "border-mint/20 bg-mint/5 text-mint"}`}>
                    {impact.risk === "high" ? <AlertTriangle className="h-5 w-5 shrink-0" /> : <CheckCircle2 className="h-5 w-5 shrink-0" />}
                    <div>
                      <span className="text-xs uppercase font-bold block">Responder Action Plan</span>
                      <p className="text-xs mt-1 leading-relaxed text-slate-300">{impact.recommendation}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-slate-400 text-sm">
                  Deployment impact analysis has not been generated yet. Ensure the worker-service background queue consumer is running.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid h-full place-items-center">
            <EmptyState title="Select a deployment to view impact details" />
          </div>
        )}
      </div>
    </div>
  );
}
