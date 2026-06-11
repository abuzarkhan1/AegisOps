import { Bell, BookOpen, Menu, UserCircle } from "lucide-react";
import { navigationItems } from "../../app/navigation";
import { IconButton } from "../ui/IconButton";
import { StatusPill } from "../ui/StatusPill";
import type { HealthState } from "../api/health";
import { CommandSearch } from "./CommandSearch";
import { EnvironmentSwitcher } from "./EnvironmentSwitcher";
import { TimeRangePicker } from "./TimeRangePicker";

export function Topbar({
  activeNav,
  status,
  onNavigate,
  onMobileMenu
}: {
  activeNav: string;
  status: HealthState;
  onNavigate: (label: string) => void;
  onMobileMenu: () => void;
}) {
  const activeItem = navigationItems.find((item) => item.label === activeNav);
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-black/95 backdrop-blur">
      <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6">
        <IconButton label="Open navigation" className="lg:hidden" onClick={onMobileMenu}>
          <Menu className="h-4 w-4" />
        </IconButton>
        <div className="hidden min-w-[160px] md:block">
          <p className="text-xs uppercase text-slate-600">{activeItem?.group ?? "AegisOps"}</p>
          <h1 className="truncate text-sm font-semibold text-white">{activeNav}</h1>
        </div>
        <CommandSearch onNavigate={onNavigate} />
        <EnvironmentSwitcher />
        <TimeRangePicker />
        <StatusPill status={status} />
        <IconButton label="Open documentation">
          <BookOpen className="h-4 w-4" />
        </IconButton>
        <IconButton label="Notifications">
          <Bell className="h-4 w-4" />
        </IconButton>
        <IconButton label="User profile" className="hidden sm:grid">
          <UserCircle className="h-4 w-4" />
        </IconButton>
      </div>
    </header>
  );
}
