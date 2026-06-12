import type { ReactNode } from "react";
import { useState } from "react";
import { navigationGroups } from "../../app/navigation";
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
    <div className="min-h-screen bg-shell text-text-primary">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-full bg-white px-3 py-2 text-sm font-semibold text-black focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <div className="flex min-h-screen">
        <Sidebar
          activeNav={activeNav}
          onNavChange={onNavChange}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((value) => !value)}
        />

        {mobileOpen ? (
          <div className="fixed inset-0 z-40 bg-black/70 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 cursor-default"
              aria-label="Close navigation"
              onClick={() => setMobileOpen(false)}
            />
            <div className="relative h-full w-[300px] border-r border-line bg-black p-4">
              <div className="mb-4 text-sm font-bold text-white">AegisOps</div>
              <div className="grid gap-1">
                {navigationGroups.map((group) => (
                  <div key={group.label} className="mb-3">
                    <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted/70">{group.label}</p>
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            onNavChange(item.label);
                            setMobileOpen(false);
                          }}
                          className={cn(
                            "flex h-10 w-full items-center gap-3 rounded-full px-3 text-left text-sm",
                            activeNav === item.label ? "bg-white/10 text-white" : "text-text-soft"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <main className="flex min-w-0 flex-1 flex-col">
          <Topbar activeNav={activeNav} status={status} onNavigate={onNavChange} onMobileMenu={() => setMobileOpen(true)} />
          <section id="main-content" className="mx-auto w-full max-w-[1760px] flex-1 px-4 py-5 sm:px-6 lg:px-8">
            {children}
          </section>
        </main>
      </div>
    </div>
  );
}
