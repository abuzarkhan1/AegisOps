export function EnvironmentSwitcher() {
  return (
    <label className="hidden items-center gap-2 text-xs text-slate-500 md:flex">
      <span className="sr-only">Environment</span>
      <select className="h-10 rounded-full border border-line bg-panel-soft px-3 text-sm text-slate-200 outline-none focus:border-mint focus:ring-2 focus:ring-mint/20">
        <option>production</option>
        <option>staging</option>
        <option>development</option>
      </select>
    </label>
  );
}
