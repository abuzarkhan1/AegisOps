import { BrainCircuit } from "lucide-react";
import { FormEvent, useState } from "react";
import { analyzeIncident, summarizeLogs } from "../../shared/api/core";

export function AiRcaPage() {
  const [incidentId, setIncidentId] = useState("inc_local");
  const [serviceName, setServiceName] = useState("checkout-api");
  const [message, setMessage] = useState("Database timeout after deployment");
  const [result, setResult] = useState<Record<string, unknown>>();
  const [status, setStatus] = useState<string>();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus("analyzing");
    const logs = [
      {
        level: "error",
        message,
        timestamp: new Date().toISOString(),
        metadata: { route: "/api/checkout", statusCode: 500 }
      }
    ];
    try {
      const [summary, analysis] = await Promise.all([
        summarizeLogs({ serviceName, logs }),
        analyzeIncident({
          incidentId,
          serviceName,
          environment: "production",
          severity: "high",
          logs,
          metricsSummary: { errorRate: 12.4, p95LatencyMs: 1450 },
          deployment: { version: "v1.0.0" }
        })
      ]);
      setResult({ summary, analysis });
      setStatus("complete");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "failed");
    }
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-line bg-panel p-4 shadow-panel">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">AI RCA</h2>
          <p className="text-sm text-slate-400">Root cause and log summarization</p>
        </div>
        <BrainCircuit className="h-5 w-5 text-amber" aria-hidden="true" />
      </div>
      <div className="grid gap-3 md:grid-cols-[160px_180px_1fr_auto]">
        <input className="h-10 rounded-md border border-line bg-[#0d1419] px-3 text-sm" value={incidentId} onChange={(event) => setIncidentId(event.target.value)} />
        <input className="h-10 rounded-md border border-line bg-[#0d1419] px-3 text-sm" value={serviceName} onChange={(event) => setServiceName(event.target.value)} />
        <input className="h-10 rounded-md border border-line bg-[#0d1419] px-3 text-sm" value={message} onChange={(event) => setMessage(event.target.value)} />
        <button className="h-10 rounded-md bg-amber px-4 text-sm font-medium text-slate-950" type="submit">Analyze</button>
      </div>
      {status ? <p className="mt-3 text-sm text-slate-300">{status}</p> : null}
      {result ? (
        <pre className="mt-4 max-h-[460px] overflow-auto rounded-lg border border-line bg-[#0d1419] p-4 text-xs leading-5 text-slate-300">
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </form>
  );
}
