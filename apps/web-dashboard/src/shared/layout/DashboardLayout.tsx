import type { ReactNode } from "react";
import type { HealthState } from "../api/health";
import { AppShell } from "./AppShell";

export function DashboardLayout({
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
  return (
    <AppShell activeNav={activeNav} onNavChange={onNavChange} status={status}>
      {children}
    </AppShell>
  );
}
