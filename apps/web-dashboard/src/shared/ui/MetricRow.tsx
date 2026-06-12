import { Tooltip } from "./Tooltip";

export function MetricRow({ label, value, help }: { label: string; value: string; help?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/10-soft pb-2 text-sm last:border-b-0 last:pb-0">
      <span className="flex min-w-0 items-center gap-1.5 text-text-soft">
        <span className="truncate">{label}</span>
        {help ? <Tooltip content={help} /> : null}
      </span>
      <span className="font-medium text-white">{value}</span>
    </div>
  );
}
