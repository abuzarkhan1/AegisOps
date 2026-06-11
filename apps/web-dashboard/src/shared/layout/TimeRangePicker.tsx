export function TimeRangePicker() {
  return (
    <label className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
      <span className="sr-only">Time range</span>
      <select className="h-10 rounded-full border border-line bg-panel-soft px-3 text-sm text-slate-200 outline-none focus:border-mint focus:ring-2 focus:ring-mint/20">
        <option>Last 15m</option>
        <option>Last 1h</option>
        <option>Last 24h</option>
        <option>Last 7d</option>
      </select>
    </label>
  );
}
