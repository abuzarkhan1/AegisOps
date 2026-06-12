import { useWorkspace } from "../../app/workspace";

export function EnvironmentSwitcher() {
  const { environment, setEnvironment } = useWorkspace();

  return (
    <label className="hidden items-center gap-2 text-xs text-text-muted md:flex">
      <span className="sr-only">Environment</span>
      <select
        aria-label="Environment"
        value={environment}
        onChange={(event) => setEnvironment(event.target.value as typeof environment)}
        className="h-10 rounded-full border border-white/10 bg-white/5 px-3 text-sm text-text-primary outline-none focus:border-white/40 focus:ring-2 focus:ring-white/10"
      >
        <option value="production">production</option>
        <option value="staging">staging</option>
        <option value="development">development</option>
      </select>
    </label>
  );
}
