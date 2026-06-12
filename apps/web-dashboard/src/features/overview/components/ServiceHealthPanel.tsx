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
    <div className="aegis-glass rounded-2xl p-4 shadow-panel">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Service Health</h2>
          <p className="text-sm text-text-soft">Gateway and core runtime checks</p>
        </div>
        <Activity className="h-5 w-5 text-white" aria-hidden="true" />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {targets.map((target) => {
          const Icon = target.icon;
          const result = health[target.name] ?? { status: "loading", detail: "checking" };
          return (
            <div key={target.name} className="aegis-glass rounded-2xl p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10">
                    <Icon className="h-4 w-4 text-white" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{target.name}</p>
                    <p className="truncate text-xs text-text-soft">{result.detail}</p>
                  </div>
                </div>
                <StatusPill status={result.status} />
              </div>
              <div className="h-2 rounded-full bg-white/10">
                <div className={`h-2 rounded-full ${result.status === "ok" ? "w-full bg-white" : "w-2/3 bg-amber"}`} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
