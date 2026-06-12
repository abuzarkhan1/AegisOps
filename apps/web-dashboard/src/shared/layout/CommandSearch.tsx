import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { navigationItems } from "../../app/navigation";

export function CommandSearch({ onNavigate }: { onNavigate: (label: string) => void }) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return navigationItems.slice(0, 6);
    return navigationItems
      .filter((item) => item.label.toLowerCase().includes(normalized) || item.group?.toLowerCase().includes(normalized))
      .slice(0, 8);
  }, [query]);

  const selectRoute = (label: string) => {
    onNavigate(label);
    setQuery("");
  };

  return (
    <div className="relative block min-w-0 flex-1">
      <span className="sr-only">Search command center</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
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
        className="h-10 w-full rounded-full border border-white/10 bg-white/5 pl-10 pr-4 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-white/40 focus:ring-2 focus:ring-white/10"
      />
      {query.trim() ? (
        <div className="absolute left-0 right-0 top-12 z-50 aegis-glass rounded-2xl p-2 shadow-panel">
          {matches.length === 0 ? <p className="px-3 py-2 text-xs text-text-muted">No route found</p> : null}
          {matches.map((item) => (
            <button
              key={item.label}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectRoute(item.label)}
              className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-text-primary hover:bg-white/10 hover:text-white"
            >
              <span>{item.label}</span>
              <span className="text-xs text-text-muted">{item.group}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
