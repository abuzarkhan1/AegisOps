import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { navigationItems } from "../../app/navigation";

export function CommandSearch({ onNavigate }: { onNavigate: (label: string) => void }) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return navigationItems.slice(0, 6);
    return navigationItems.filter((item) => item.label.toLowerCase().includes(normalized) || item.group?.toLowerCase().includes(normalized)).slice(0, 8);
  }, [query]);

  const selectRoute = (label: string) => {
    onNavigate(label);
    setQuery("");
  };

  return (
    <div className="relative block min-w-0 flex-1">
      <span className="sr-only">Search command center</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <input
        role="combobox"
        aria-label="Search command center"
        aria-expanded={query.trim() ? "true" : "false"}
        placeholder="Search AegisOps"
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setQuery("");
            return;
          }
          if (event.key === "Enter" && matches[0]) {
            event.preventDefault();
            selectRoute(matches[0].label);
          }
        }}
        className="h-10 w-full rounded-full border border-line bg-panel-soft pl-10 pr-4 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-mint focus:ring-2 focus:ring-mint/20"
      />
      {query.trim() ? (
        <div className="absolute left-0 right-0 top-12 z-50 rounded-lg border border-line bg-panel p-2 shadow-panel">
          {matches.length === 0 ? <p className="px-3 py-2 text-xs text-slate-500">No route found</p> : null}
          {matches.map((item) => (
            <button
              key={item.label}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectRoute(item.label)}
              className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-slate-200 hover:bg-panel-hover hover:text-white"
            >
              <span>{item.label}</span>
              <span className="text-xs text-slate-500">{item.group}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
