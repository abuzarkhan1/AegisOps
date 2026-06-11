import { Search } from "lucide-react";
import { navigationItems } from "../../app/navigation";

export function CommandSearch({ onNavigate }: { onNavigate: (label: string) => void }) {
  return (
    <label className="relative block min-w-0 flex-1">
      <span className="sr-only">Search command center</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <input
        list="aegisops-command-search"
        placeholder="Search AegisOps"
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          const value = event.currentTarget.value.trim().toLowerCase();
          const match = navigationItems.find((item) => item.label.toLowerCase() === value);
          if (match) {
            onNavigate(match.label);
            event.currentTarget.value = "";
          }
        }}
        className="h-10 w-full rounded-full border border-line bg-panel-soft pl-10 pr-4 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-mint focus:ring-2 focus:ring-mint/20"
      />
      <datalist id="aegisops-command-search">
        {navigationItems.map((item) => <option key={item.label} value={item.label} />)}
      </datalist>
    </label>
  );
}
