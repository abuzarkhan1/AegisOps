import { useWorkspace } from "../../app/workspace";

export function TimeRangePicker() {
  const { timeRange, setTimeRange } = useWorkspace();

  return (
    <label className="hidden items-center gap-2 text-xs text-text-muted sm:flex">
      <span className="sr-only">Time range</span>
      <select
        aria-label="Time range"
        value={timeRange}
        onChange={(event) => setTimeRange(event.target.value as typeof timeRange)}
        className="h-10 rounded-full border border-white/10 bg-white/5 px-3 text-sm text-text-primary outline-none focus:border-white/40 focus:ring-2 focus:ring-white/10"
      >
        <option value="15m">Last 15m</option>
        <option value="1h">Last 1h</option>
        <option value="24h">Last 24h</option>
        <option value="7d">Last 7d</option>
      </select>
    </label>
  );
}
