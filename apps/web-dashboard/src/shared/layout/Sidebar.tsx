import { ChevronLeft, ShieldCheck } from "lucide-react";
import { navigationGroups } from "../../app/navigation";
import type { NavigationItem } from "../../app/navigation";
import { cn } from "../lib/cn";

export function Sidebar({
  activeNav,
  onNavChange,
  collapsed,
  onToggleCollapsed
}: {
  activeNav: string;
  onNavChange: (label: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  return (
    <aside className={cn("hidden border-r border-line bg-black lg:flex lg:flex-col", collapsed ? "w-[84px]" : "w-[276px]")}>
      <div className="flex h-16 items-center gap-3 border-b border-line px-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-mint/40 bg-mint/10">
          <ShieldCheck className="h-5 w-5 text-mint" aria-hidden="true" />
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-white">AegisOps</p>
            <p className="truncate text-xs text-slate-500">Aegis X Command</p>
          </div>
        ) : null}
        <button
          type="button"
          aria-label="Collapse sidebar"
          onClick={onToggleCollapsed}
          className="ml-auto hidden h-8 w-8 place-items-center rounded-full text-slate-500 hover:bg-panel-hover hover:text-white xl:grid"
        >
          <ChevronLeft className={cn("h-4 w-4 transition", collapsed && "rotate-180")} />
        </button>
      </div>

      {!collapsed ? (
        <div className="border-b border-line px-4 py-3">
          <p className="text-xs uppercase text-slate-500">Workspace</p>
          <button type="button" className="mt-2 flex w-full items-center justify-between rounded-md border border-line bg-panel-soft px-3 py-2 text-left text-sm text-slate-200 hover:bg-panel-hover">
            Production Ops
            <span className="h-2 w-2 rounded-full bg-success" />
          </button>
        </div>
      ) : null}

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {navigationGroups.map((group) => (
          <div key={group.label} className="mb-5 last:mb-0">
            {!collapsed ? <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600">{group.label}</p> : null}
            <div className="space-y-1">
              {group.items.map((item) => (
                <SidebarItem key={item.label} item={item} active={activeNav === item.label} collapsed={collapsed} onNavChange={onNavChange} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-line p-3">
        <button type="button" className={cn("flex w-full items-center gap-3 rounded-full p-2 text-left hover:bg-panel-hover", collapsed && "justify-center")}>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-panel-hover text-sm font-bold text-white">AO</span>
          {!collapsed ? (
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-white">Ops Admin</span>
              <span className="block truncate text-xs text-slate-500">@aegisops</span>
            </span>
          ) : null}
        </button>
      </div>
    </aside>
  );
}

function SidebarItem({
  item,
  active,
  collapsed,
  onNavChange
}: {
  item: NavigationItem;
  active: boolean;
  collapsed: boolean;
  onNavChange: (label: string) => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      title={item.label}
      onClick={() => onNavChange(item.label)}
      className={cn(
        "flex h-10 w-full items-center gap-3 rounded-full px-3 text-left text-sm transition",
        active ? "bg-mint/15 text-white ring-1 ring-mint/30" : "text-slate-400 hover:bg-panel-hover hover:text-white",
        collapsed && "justify-center px-0"
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-mint" : "")} aria-hidden="true" />
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
    </button>
  );
}
