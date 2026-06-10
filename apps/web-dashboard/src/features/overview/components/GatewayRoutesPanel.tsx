import { RadioTower } from "lucide-react";

const foundationServices = [
  { name: "Log Ingester", port: 5001, route: "/ingest/logs", accent: "bg-mint" },
  { name: "Metrics Service", port: 5002, route: "/metrics-api/ingest", accent: "bg-amber" },
  { name: "AI RCA", port: 8000, route: "/ai/analyze-incident", accent: "bg-sky-400" },
  { name: "Notifications", port: 8085, route: "/notify/history", accent: "bg-rose" },
  { name: "Deployments", port: 4010, route: "/deployments/github", accent: "bg-violet-400" }
];

export function GatewayRoutesPanel() {
  return (
    <div className="mt-4 rounded-lg border border-line bg-panel p-4 shadow-panel">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Gateway Routes</h2>
          <p className="text-sm text-slate-400">Configured reverse proxy targets</p>
        </div>
        <RadioTower className="h-5 w-5 text-mint" aria-hidden="true" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {foundationServices.map((service) => (
          <div key={service.name} className="rounded-lg border border-line bg-[#0d1419] p-3">
            <div className={`mb-3 h-1.5 w-10 rounded-full ${service.accent}`} />
            <p className="truncate text-sm font-medium text-white">{service.name}</p>
            <p className="mt-1 truncate text-xs text-slate-400">{service.route}</p>
            <p className="mt-3 text-xs text-slate-500">:{service.port}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
