import { useWorkspace } from "../../app/workspace";

export function EnvironmentSwitcher() {
  const { environment, setEnvironment } = useWorkspace();

  return (
    <label className="hidden items-center gap-2 text-xs text-slate-500 md:flex">
      <span className="sr-only">Environment</span>
      <select
        aria-label="Environment"
        value={environment}
        onChange={(event) => setEnvironment(event.target.value as typeof environment)}
        className="h-10 rounded-full border border-line bg-panel-soft px-3 text-sm text-slate-200 outline-none focus:border-mint focus:ring-2 focus:ring-mint/20"
      >
        <option value="production">production</option>
        <option value="staging">staging</option>
        <option value="development">development</option>
      </select>
    </label>
  );
}
