export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-5 shadow-panel">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-24 rounded-lg border border-line bg-[#0d1419]" />
        ))}
      </div>
    </div>
  );
}

