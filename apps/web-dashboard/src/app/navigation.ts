import {
  BellRing,
  BrainCircuit,
  Gauge,
  GitBranch,
  LayoutDashboard,
  ListTree,
  Settings,
  Siren,
  TerminalSquare,
  BarChart3
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavigationItem = {
  label: string;
  icon: LucideIcon;
};

export const navigationItems: NavigationItem[] = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Services", icon: ListTree },
  { label: "Incidents", icon: Siren },
  { label: "Logs", icon: TerminalSquare },
  { label: "Metrics", icon: Gauge },
  { label: "Deployments", icon: GitBranch },
  { label: "Reports", icon: BarChart3 },
  { label: "AI RCA", icon: BrainCircuit },
  { label: "Notifications", icon: BellRing },
  { label: "Settings", icon: Settings }
];
