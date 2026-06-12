import {
  BellRing,
  BrainCircuit,
  Gauge,
  GitBranch,
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  ListTree,
  Settings,
  Siren,
  ScrollText,
  TerminalSquare,
  BarChart3,
  ActivitySquare,
  UsersRound,
  Cable,
  LayoutPanelTop,
  Radar,
  Rocket,
  SearchCode,
  ShieldAlert,
  Waves
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavigationItem = {
  label: string;
  icon: LucideIcon;
  path?: string;
  group?: string;
};

export type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

export const navigationGroups: NavigationGroup[] = [
  {
    label: "Start",
    items: [
      { label: "Overview", icon: LayoutDashboard, path: "/overview" },
      { label: "Connect Project", icon: Cable, path: "/connect-project" },
      { label: "Projects", icon: FolderKanban }
    ]
  },
  {
    label: "Monitor",
    items: [
      { label: "Logs", icon: TerminalSquare },
      { label: "Metrics", icon: Gauge },
      { label: "Incidents", icon: Siren },
      { label: "Alert Rules", icon: ActivitySquare },
      { label: "AI RCA", icon: BrainCircuit },
      { label: "Settings", icon: Settings }
    ]
  },
  {
    label: "Advanced",
    items: [
      { label: "Services", icon: ListTree },
      { label: "Service Catalog", icon: LayoutPanelTop },
      { label: "API Keys", icon: KeyRound },
      { label: "Dashboards", icon: BarChart3 },
      { label: "Issues", icon: ShieldAlert },
      { label: "SLOs", icon: Waves },
      { label: "Synthetics", icon: Radar },
      { label: "Deployments", icon: GitBranch },
      { label: "Releases", icon: Rocket },
      { label: "AI Investigations", icon: SearchCode },
      { label: "Notifications", icon: BellRing },
      { label: "Reports", icon: BarChart3 },
      { label: "Team", icon: UsersRound },
      { label: "Audit Logs", icon: ScrollText }
    ]
  }
];

export const navigationItems: NavigationItem[] = navigationGroups.flatMap((group) =>
  group.items.map((item) => ({ ...item, group: group.label }))
);

export const navPath = (label: string, path?: string) =>
  path ??
  `/${label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}`;

export const navByPath = Object.fromEntries(navigationItems.map((item) => [navPath(item.label, item.path), item.label]));
