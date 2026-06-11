import type { HealthState } from "../api/health";

const statusClasses: Record<HealthState, string> = {
  loading: "border-line bg-panel-soft text-slate-300",
  ok: "border-success/40 bg-success/10 text-success",
  degraded: "border-amber/40 bg-amber/10 text-amber",
  offline: "border-rose/40 bg-rose/10 text-rose"
};

export function StatusPill({ status }: { status: HealthState }) {
  return (
    <span className={`shrink-0 rounded-md border px-2 py-1 text-xs font-medium ${statusClasses[status]}`}>
      {status}
    </span>
  );
}
