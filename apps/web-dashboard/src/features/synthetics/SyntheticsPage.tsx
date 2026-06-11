import { Play, RefreshCw, Wifi } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { coreApiUrl, gatewayUrl } from "../../app/config";
import { Button } from "../../shared/ui/Button";
import { Card, StatCard } from "../../shared/ui/Card";
import { StatusBadge } from "../../shared/ui/Badge";

type ProbeTarget = {
  name: string;
  url: string;
  method?: "GET" | "OPTIONS";
  expectedStatus?: number[];
};

type ProbeResult = ProbeTarget & {
  status: "ok" | "degraded" | "offline";
  httpStatus?: number;
  latencyMs?: number;
  detail: string;
  checkedAt: string;
};

const targets: ProbeTarget[] = [
  { name: "Gateway", url: `${gatewayUrl}/health` },
  { name: "Core API", url: `${coreApiUrl}/health` },
  { name: "OpenAPI Schema", url: `${coreApiUrl}/api/docs/openapi.json` },
  { name: "Log Ingestion", url: `${gatewayUrl}/ingest/health` },
  { name: "Metrics Ingestion", url: `${gatewayUrl}/metrics-api/health` },
  { name: "AI RCA", url: `${gatewayUrl}/ai/health` },
  { name: "Notifications", url: `${gatewayUrl}/notify/health` },
  { name: "Deployments", url: `${gatewayUrl}/deployments` }
];

async function runProbe(target: ProbeTarget): Promise<ProbeResult> {
  const started = performance.now();
  try {
    const response = await fetch(target.url, { method: target.method ?? "GET" });
    const latencyMs = Math.round(performance.now() - started);
    const expected = target.expectedStatus ?? [200];
    const bodyText = await response.text();
    let detail = response.statusText || "HTTP response";
    if (bodyText) {
      try {
        const parsed = JSON.parse(bodyText) as Record<string, unknown>;
        detail = String(parsed.service ?? parsed.status ?? parsed.message ?? detail);
      } catch {
        detail = bodyText.slice(0, 120);
      }
    }
    return {
      ...target,
      status: expected.includes(response.status) ? "ok" : "degraded",
      httpStatus: response.status,
      latencyMs,
      detail,
      checkedAt: new Date().toISOString()
    };
  } catch (error) {
    return {
      ...target,
      status: "offline",
      detail: error instanceof Error ? error.message : "unreachable",
      checkedAt: new Date().toISOString()
    };
  }
}

export function SyntheticsPage() {
  const [results, setResults] = useState<ProbeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  async function runAll() {
    setLoading(true);
    setStatus("Running probes");
    try {
      const probeResults = await Promise.all(targets.map(runProbe));
      setResults(probeResults);
      const failed = probeResults.filter((result) => result.status !== "ok").length;
      setStatus(failed ? `${failed} probe${failed === 1 ? "" : "s"} need attention` : "All probes passed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    runAll();
  }, []);

  const summary = useMemo(() => ({
    ok: results.filter((result) => result.status === "ok").length,
    degraded: results.filter((result) => result.status === "degraded").length,
    offline: results.filter((result) => result.status === "offline").length,
    avgLatency: results.length ? Math.round(results.reduce((sum, result) => sum + (result.latencyMs ?? 0), 0) / results.length) : 0
  }), [results]);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Synthetics</h2>
          <p className="mt-1 text-sm text-slate-400">Browser-run health probes against gateway and backend service endpoints.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={<RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />} disabled={loading} onClick={runAll}>
            Refresh
          </Button>
          <Button variant="primary" icon={<Play className="h-4 w-4" />} disabled={loading} onClick={runAll}>
            Run Probes
          </Button>
        </div>
      </div>

      {status ? <div className="rounded-lg border border-line bg-panel-soft p-3 text-sm text-slate-300">{status}</div> : null}

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Passing" value={summary.ok} detail="HTTP status matched" />
        <StatCard label="Degraded" value={summary.degraded} detail="reachable but unexpected" />
        <StatCard label="Offline" value={summary.offline} detail="fetch failed" />
        <StatCard label="Avg latency" value={`${summary.avgLatency}ms`} detail="browser observed" />
      </div>

      <Card title="Probe Results" description="Checks use the same browser network path as the dashboard.">
        <div className="grid gap-3 xl:grid-cols-2">
          {results.map((result) => (
            <div key={result.name} className="rounded-lg border border-line bg-panel-soft p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Wifi className="h-4 w-4 text-mint" />
                    <h3 className="text-sm font-semibold text-white">{result.name}</h3>
                  </div>
                  <p className="mt-2 break-all text-xs text-slate-500">{result.url}</p>
                </div>
                <StatusBadge status={result.status} />
              </div>
              <div className="mt-4 grid gap-2 text-sm text-slate-400 sm:grid-cols-3">
                <p>HTTP<br /><span className="font-mono text-slate-200">{result.httpStatus ?? "-"}</span></p>
                <p>Latency<br /><span className="font-mono text-slate-200">{result.latencyMs ?? "-"}ms</span></p>
                <p>Checked<br /><span className="font-mono text-slate-200">{new Date(result.checkedAt).toLocaleTimeString()}</span></p>
              </div>
              <p className="mt-3 text-sm text-slate-300">{result.detail}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
