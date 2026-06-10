import {
  BellRing,
  BrainCircuit,
  Gauge,
  GitBranch,
  FolderKanban,
  LayoutDashboard,
  ListTree,
  Settings,
  Siren,
  TerminalSquare,
  BarChart3,
  ActivitySquare,
  UsersRound
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavigationItem = {
  label: string;
  icon: LucideIcon;
};

export const navigationItems: NavigationItem[] = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Projects", icon: FolderKanban },
  { label: "Services", icon: ListTree },
  { label: "Alert Rules", icon: ActivitySquare },
  { label: "Incidents", icon: Siren },
  { label: "Logs", icon: TerminalSquare },
  { label: "Metrics", icon: Gauge },
  { label: "Deployments", icon: GitBranch },
  { label: "Reports", icon: BarChart3 },
  { label: "AI RCA", icon: BrainCircuit },
  { label: "Notifications", icon: BellRing },
  { label: "Team", icon: UsersRound },
  { label: "Settings", icon: Settings }
];
