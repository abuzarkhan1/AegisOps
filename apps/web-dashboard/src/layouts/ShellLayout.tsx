import { Bell, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { navigationItems } from "../app/navigation";
import { StatusPill } from "../shared/ui/StatusPill";
import type { HealthState } from "../shared/api/health";

type ShellLayoutProps = {
  activeNav: string;
  onNavChange: (label: string) => void;
  status: HealthState;
  children: ReactNode;
};

export function ShellLayout({ activeNav, onNavChange, status, children }: ShellLayoutProps) {
  return (
    <div className="min-h-screen bg-shell text-slate-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 border-r border-line bg-[#0d1419] px-4 py-5 lg:block">
          <div className="mb-8 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg border border-mint/40 bg-mint/10">
              <ShieldCheck className="h-5 w-5 text-mint" aria-hidden="true" />
            </div>
            <div>
              <p className="text-base font-semibold">AegisOps</p>
              <p className="text-xs text-slate-400">SRE Console</p>
            </div>
          </div>

          <nav className="space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const active = activeNav === item.label;
              return (
                <button
                  key={item.label}
                  type="button"
                  title={item.label}
                  onClick={() => onNavChange(item.label)}
                  className={`flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm transition ${
                    active
                      ? "bg-slate-100 text-slate-950"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex min-h-16 items-center justify-between border-b border-line bg-panel px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <p className="text-xs uppercase text-mint">Foundation</p>
              <h1 className="truncate text-xl font-semibold text-white">Incident Operations Overview</h1>
            </div>
            <div className="flex items-center gap-2">
              <StatusPill status={status} />
              <button
                type="button"
                title="Notifications"
                className="grid h-10 w-10 place-items-center rounded-md border border-line bg-[#0f171d] text-slate-300 hover:text-white"
              >
                <Bell className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </header>

          <nav className="flex gap-2 overflow-x-auto border-b border-line bg-[#0d1419] px-4 py-2 lg:hidden">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const active = activeNav === item.label;
              return (
                <button
                  key={item.label}
                  type="button"
                  title={item.label}
                  onClick={() => onNavChange(item.label)}
                  className={`flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm transition ${
                    active
                      ? "bg-slate-100 text-slate-950"
                      : "border border-line bg-[#0f171d] text-slate-300"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <section className="flex-1 px-4 py-5 sm:px-6 lg:px-8">{children}</section>
        </main>
      </div>
    </div>
  );
}
