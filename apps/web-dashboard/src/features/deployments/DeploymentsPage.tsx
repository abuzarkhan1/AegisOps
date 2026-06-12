import { GitBranch, Clock, ArrowRight, CheckCircle2, AlertTriangle, RefreshCw, BarChart } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchDeployments, fetchDeploymentImpact } from "../../shared/api/core";
import type { DeploymentRecord } from "../../shared/api/core";
import { EmptyState } from "../../shared/ui/EmptyState";

const riskColors: Record<string, string> = {
  high: "border-rose-500/40 bg-rose-500/10 text-rose-400 font-bold",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-400 font-medium",
  low: "border-white/25 bg-white/10 text-white"
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
      <div className="aegis-glass rounded-2xl p-5 shadow-panel flex flex-col h-[750px]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Deployments</h2>
            <p className="text-xs text-text-soft">Webhook-tracked pipeline releases</p>
          </div>
          <button onClick={loadDeployments} disabled={loading} className="p-2 rounded-md hover:bg-white/10 text-text-soft hover:text-white">
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
                className={`cursor-pointer rounded-2xl border p-4 transition text-left ${
                  active ? "border-white/40 bg-white/10" : "border-white/10 bg-white/5 hover:border-white/10 hover:bg-white/10"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-white">{dep.serviceName}</p>
                  <span className="rounded bg-white/10 border border-white/10 px-1.5 py-0.5 text-[10px] font-mono shrink-0 text-text-soft">
                    {dep.version || "v?"}
                  </span>
                </div>
                <p className="text-xs text-text-soft font-mono mt-1">Commit: {dep.commitSha?.slice(0, 7) || "None"}</p>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-text-muted">
                  <span className="capitalize">{dep.provider}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(dep.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            );
          })}
          {deployments.length === 0 && !loading ? <EmptyState title="No deployments tracked yet" /> : null}
        </div>
      </div>

      {/* Deployment Impact Panel */}
      <div className="flex flex-col h-[750px] overflow-y-auto aegis-glass rounded-2xl p-6 shadow-panel">
        {selectedDeployment ? (
          <div className="space-y-6 text-left">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-white">Deployment: {selectedDeployment.serviceName}</h2>
                  <span className="rounded-2xl border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-text-soft font-mono">
                    {selectedDeployment.version || "unknown-version"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-text-soft font-mono">Deployment ID: {selectedDeployment.id}</p>
              </div>

              <div className="flex items-center gap-2">
                <span className="rounded border border-white/10 px-3 py-1.5 bg-white/5 text-xs font-mono text-text-soft">
                  Env: {selectedDeployment.environment}
                </span>
                <span className="rounded border border-white/10 px-3 py-1.5 bg-white/5 text-xs text-text-soft">
                  Author: {selectedDeployment.deployedBy || "Webhook"}
                </span>
              </div>
            </div>

            {/* Commit details */}
            <div className="aegis-glass rounded-2xl p-4 flex justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <GitBranch className="h-5 w-5 text-white" />
                <div>
                  <span className="text-xs text-text-soft uppercase block font-semibold">Repository SHA</span>
                  <span className="text-sm text-text-primary font-mono">{selectedDeployment.commitSha || "No SHA provided"}</span>
                </div>
              </div>
              <span className="text-xs text-text-muted">{new Date(selectedDeployment.createdAt).toLocaleString()}</span>
            </div>

            {/* AI Deployment Impact Report */}
            <div className="aegis-glass rounded-2xl p-6 hover:bg-white/10">
              <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-3">
                <BarChart className="h-5 w-5 text-white" />
                <h3 className="text-base font-bold text-white">AI Deployment Impact Report</h3>
                {impact && impact.status === "complete" && (
                  <span
                    className={`ml-auto rounded border px-2 py-0.5 text-xs uppercase font-bold ${riskColors[impact.risk] ?? "text-text-soft"}`}
                  >
                    Risk: {impact.risk}
                  </span>
                )}
              </div>

              {loadingImpact ? (
                <div className="py-6 text-center text-text-soft text-sm">Evaluating metrics...</div>
              ) : impact && impact.status === "complete" ? (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-xs font-bold uppercase text-text-soft mb-1">Impact Summary</h4>
                    <p className="text-sm leading-relaxed text-text-primary">{impact.summary}</p>
                  </div>

                  {/* Metrics Diff */}
                  <div>
                    <h4 className="text-xs font-bold uppercase text-text-soft mb-2">
                      Pre vs. Post Deployment Metrics Comparison (30m window)
                    </h4>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded border border-white/10 bg-white/5 p-4">
                        <span className="text-xs font-bold text-text-soft block mb-2">API Error Rate</span>
                        <div className="flex items-center justify-between">
                          <div className="text-text-soft text-xs">
                            Before: <span className="font-semibold">{impact.beforeMetrics?.errorRate}%</span>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-text-muted" />
                          <div className="text-rose-400 text-sm font-bold">
                            After: <span>{impact.afterMetrics?.errorRate}%</span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded border border-white/10 bg-white/5 p-4">
                        <span className="text-xs font-bold text-text-soft block mb-2">Tail Latency (P95)</span>
                        <div className="flex items-center justify-between">
                          <div className="text-text-soft text-xs">
                            Before:{" "}
                            <span className="font-semibold">
                              {impact.beforeMetrics?.p95LatencyMs || impact.beforeMetrics?.avgLatencyMs}ms
                            </span>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-text-muted" />
                          <div className="text-amber-400 text-sm font-bold">
                            After: <span>{impact.afterMetrics?.p95LatencyMs || impact.afterMetrics?.avgLatencyMs}ms</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div
                    className={`rounded-2xl border p-4 flex gap-3 ${impact.risk === "high" ? "border-rose-500/20 bg-rose-500/5 text-rose-300" : "border-white/15 bg-white/5 text-white"}`}
                  >
                    {impact.risk === "high" ? (
                      <AlertTriangle className="h-5 w-5 shrink-0" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 shrink-0" />
                    )}
                    <div>
                      <span className="text-xs uppercase font-bold block">Responder Action Plan</span>
                      <p className="text-xs mt-1 leading-relaxed text-text-soft">{impact.recommendation}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-text-soft text-sm">
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
