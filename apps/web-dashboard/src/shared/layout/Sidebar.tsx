import { ChevronDown, ChevronLeft, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../app/auth";
import { navigationGroups } from "../../app/navigation";
import type { NavigationItem } from "../../app/navigation";
import { queryKeys, queryStaleTimes } from "../../app/queryClient";
import { fetchOrganizations } from "../api/core";
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
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const { user } = useAuth();
  const { data: organizations = [] } = useQuery({
    queryKey: queryKeys.organizations(),
    queryFn: fetchOrganizations,
    staleTime: queryStaleTimes.settings
  });
  const organizationName = organizations[0]?.name ?? "Workspace";
  const displayName = user?.name ?? user?.email ?? "AegisOps user";
  const initials =
    displayName
      .split(/\s|@/)
      .filter(Boolean)
      .slice(0, 2)
      .map((item) => item[0]?.toUpperCase())
      .join("") || "AO";

  return (
    <aside
      className={cn(
        "hidden shrink-0 border-r border-line bg-black transition-[width] duration-300 ease-out lg:flex lg:flex-col",
        collapsed ? "w-[84px]" : "w-[276px]"
      )}
    >
      <div className="flex h-16 items-center gap-3 border-b border-line px-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/20 bg-white/10">
          <ShieldCheck className="h-5 w-5 text-text-primary" aria-hidden="true" />
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-white">AegisOps</p>
            <p className="truncate text-xs text-text-muted">Command workspace</p>
          </div>
        ) : null}
        <button
          type="button"
          aria-label="Collapse sidebar"
          onClick={onToggleCollapsed}
          className="ml-auto hidden h-8 w-8 place-items-center rounded-full text-text-muted hover:bg-panel-hover hover:text-white xl:grid"
        >
          <ChevronLeft className={cn("h-4 w-4 transition", collapsed && "rotate-180")} />
        </button>
      </div>

      {!collapsed ? (
        <div className="border-b border-line px-4 py-3">
          <p className="text-xs uppercase text-text-muted">Workspace</p>
          <button
            type="button"
            className="mt-2 flex w-full items-center justify-between gap-3 rounded-md border border-line bg-panel-soft px-3 py-2 text-left text-sm text-text-primary hover:bg-panel-hover"
          >
            <span className="min-w-0 truncate">{organizationName}</span>
            <span className="h-2 w-2 shrink-0 rounded-full bg-success" />
          </button>
        </div>
      ) : null}

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {navigationGroups.map((group) => {
          const isAdvanced = group.label === "Advanced";
          const showItems = !isAdvanced || advancedOpen || collapsed;
          return (
            <div key={group.label} className="mb-5 last:mb-0">
              {!collapsed ? (
                isAdvanced ? (
                  <button
                    type="button"
                    onClick={() => setAdvancedOpen((value) => !value)}
                    className="mb-2 flex w-full items-center justify-between rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted/70 hover:bg-panel-hover hover:text-text-soft"
                  >
                    {group.label}
                    <ChevronDown className={cn("h-3.5 w-3.5 transition", advancedOpen && "rotate-180")} />
                  </button>
                ) : (
                  <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted/70">{group.label}</p>
                )
              ) : null}
              <div className="space-y-1">
                {showItems
                  ? group.items.map((item) => (
                      <SidebarItem
                        key={item.label}
                        item={item}
                        active={activeNav === item.label}
                        collapsed={collapsed}
                        onNavChange={onNavChange}
                      />
                    ))
                  : null}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-line p-3">
        <button
          type="button"
          className={cn("flex w-full items-center gap-3 rounded-full p-2 text-left hover:bg-panel-hover", collapsed && "justify-center")}
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-panel-hover text-sm font-bold text-white">{initials}</span>
          {!collapsed ? (
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-white">{displayName}</span>
              <span className="block truncate text-xs text-text-muted">{user?.email ?? organizationName}</span>
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
        active ? "bg-white/[0.12] text-white ring-1 ring-white/20" : "text-text-soft hover:bg-panel-hover hover:text-white",
        collapsed && "justify-center px-0"
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-white" : "")} aria-hidden="true" />
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
    </button>
  );
}
