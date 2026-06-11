import { Activity } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { HealthResult } from "../../../shared/api/health";
import { StatusPill } from "../../../shared/ui/StatusPill";

type ServiceHealthPanelProps = {
  targets: Array<{ name: string; icon: LucideIcon }>;
  health: Record<string, HealthResult>;
};

export function ServiceHealthPanel({ targets, health }: ServiceHealthPanelProps) {
  return (
    <div className="rounded-lg border border-line bg-panel p-4 shadow-panel">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Service Health</h2>
          <p className="text-sm text-slate-400">Gateway and core runtime checks</p>
        </div>
        <Activity className="h-5 w-5 text-mint" aria-hidden="true" />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {targets.map((target) => {
          const Icon = target.icon;
          const result = health[target.name] ?? { status: "loading", detail: "checking" };
          return (
            <div key={target.name} className="rounded-lg border border-line bg-panel-soft p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-panel-hover">
                    <Icon className="h-4 w-4 text-mint" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{target.name}</p>
                    <p className="truncate text-xs text-slate-400">{result.detail}</p>
                  </div>
                </div>
                <StatusPill status={result.status} />
              </div>
              <div className="h-2 rounded-full bg-panel-hover">
                <div
                  className={`h-2 rounded-full ${result.status === "ok" ? "w-full bg-mint" : "w-2/3 bg-amber"}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

