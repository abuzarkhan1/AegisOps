export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-5 shadow-panel">
      <p className="text-xs uppercase text-slate-500">Planned surface</p>
      <h2 className="mt-1 text-lg font-semibold text-white">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm text-slate-400">
        This area is reserved in the Aegis X Command navigation and will be implemented after the core monitoring foundation is stable.
      </p>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-24 rounded-lg border border-line bg-panel-soft" />
        ))}
      </div>
    </div>
  );
}
