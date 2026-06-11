import type { ReactNode } from "react";
import { useState } from "react";
import { navigationItems } from "../../app/navigation";
import type { HealthState } from "../api/health";
import { cn } from "../lib/cn";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({
  activeNav,
  onNavChange,
  status,
  children
}: {
  activeNav: string;
  onNavChange: (label: string) => void;
  status: HealthState;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-shell text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar activeNav={activeNav} onNavChange={onNavChange} collapsed={collapsed} onToggleCollapsed={() => setCollapsed((value) => !value)} />

        {mobileOpen ? (
          <div className="fixed inset-0 z-40 bg-black/70 lg:hidden" onClick={() => setMobileOpen(false)}>
            <div className="h-full w-[300px] border-r border-line bg-black p-4" onClick={(event) => event.stopPropagation()}>
              <div className="mb-4 text-sm font-bold text-white">AegisOps</div>
              <div className="grid gap-1">
                {navigationItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        onNavChange(item.label);
                        setMobileOpen(false);
                      }}
                      className={cn("flex h-10 items-center gap-3 rounded-full px-3 text-left text-sm", activeNav === item.label ? "bg-mint/15 text-white" : "text-slate-400")}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        <main className="flex min-w-0 flex-1 flex-col">
          <Topbar activeNav={activeNav} status={status} onNavigate={onNavChange} onMobileMenu={() => setMobileOpen(true)} />
          <section className="mx-auto w-full max-w-[1760px] flex-1 px-4 py-5 sm:px-6 lg:px-8">{children}</section>
        </main>
      </div>
    </div>
  );
}
