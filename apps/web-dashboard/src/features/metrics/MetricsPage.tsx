import { Gauge } from "lucide-react";
import { FormEvent, useState } from "react";
import { ingestMetric } from "../../shared/api/core";

export function MetricsPage() {
  const [apiKey, setApiKey] = useState("");
  const [value, setValue] = useState(430);
  const [status, setStatus] = useState<string>();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus("sending");
    try {
      const result = await ingestMetric(apiKey, {
        serviceName: "checkout-api",
        environment: "production",
        metrics: {
          requestCount: 1200,
          errorCount: 31,
          avgLatencyMs: value,
          p95LatencyMs: Math.round(value * 1.65),
          cpuUsage: 61.2,
          memoryUsage: 74.4
        },
        timestamp: new Date().toISOString(),
        labels: { route: "/api/checkout" }
      });
      setStatus(`${result.status} -> ${result.topic}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "failed");
    }
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-line bg-panel p-4 shadow-panel">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Metrics</h2>
          <p className="text-sm text-slate-400">metrics.received</p>
        </div>
        <Gauge className="h-5 w-5 text-amber" aria-hidden="true" />
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
        <input className="h-10 rounded-md border border-line bg-[#0d1419] px-3 text-sm" placeholder="API key" value={apiKey} onChange={(event) => setApiKey(event.target.value)} />
        <input className="h-10 rounded-md border border-line bg-[#0d1419] px-3 text-sm" type="number" value={value} onChange={(event) => setValue(Number(event.target.value))} />
        <button className="h-10 rounded-md bg-amber px-4 text-sm font-medium text-slate-950" type="submit">Send</button>
      </div>
      {status ? <p className="mt-3 text-sm text-slate-300">{status}</p> : null}
    </form>
  );
}
