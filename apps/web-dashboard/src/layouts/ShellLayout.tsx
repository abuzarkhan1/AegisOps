import type { ReactNode } from "react";
import type { HealthState } from "../shared/api/health";
import { AppShell } from "../shared/layout/AppShell";

type ShellLayoutProps = {
  activeNav: string;
  onNavChange: (label: string) => void;
  status: HealthState;
  children: ReactNode;
};

export function ShellLayout({ activeNav, onNavChange, status, children }: ShellLayoutProps) {
  return <AppShell activeNav={activeNav} onNavChange={onNavChange} status={status}>{children}</AppShell>;
}
