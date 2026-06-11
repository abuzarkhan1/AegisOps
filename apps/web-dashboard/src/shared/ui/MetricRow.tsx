export function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line-soft pb-2 text-sm last:border-b-0 last:pb-0">
      <span className="truncate text-slate-400">{label}</span>
      <span className="font-medium text-white">{value}</span>
    </div>
  );
}
