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
  planned?: boolean;
};

export type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

export const navigationGroups: NavigationGroup[] = [
  {
    label: "Command Center",
    items: [
      { label: "Overview", icon: LayoutDashboard },
      { label: "Connect Project", icon: Cable, path: "/connect-project" }
    ]
  },
  {
    label: "Monitoring",
    items: [
      { label: "Projects", icon: FolderKanban },
      { label: "Services", icon: ListTree },
      { label: "Service Catalog", icon: LayoutPanelTop, planned: true },
      { label: "Logs", icon: TerminalSquare },
      { label: "Metrics", icon: Gauge },
      { label: "Dashboards", icon: BarChart3, planned: true }
    ]
  },
  {
    label: "Reliability",
    items: [
      { label: "Issues", icon: ShieldAlert, planned: true },
      { label: "Incidents", icon: Siren },
      { label: "Alert Rules", icon: ActivitySquare },
      { label: "SLOs", icon: Waves, planned: true },
      { label: "Synthetics", icon: Radar, planned: true }
    ]
  },
  {
    label: "AI",
    items: [
      { label: "AI RCA", icon: BrainCircuit },
      { label: "AI Investigations", icon: SearchCode, planned: true }
    ]
  },
  {
    label: "Delivery",
    items: [
      { label: "Deployments", icon: GitBranch },
      { label: "Releases", icon: Rocket, planned: true }
    ]
  },
  {
    label: "Organization",
    items: [
      { label: "API Keys", icon: KeyRound },
      { label: "Notifications", icon: BellRing },
      { label: "Reports", icon: BarChart3 },
      { label: "Team", icon: UsersRound },
      { label: "Audit Logs", icon: ScrollText },
      { label: "Settings", icon: Settings }
    ]
  }
];

export const navigationItems: NavigationItem[] = navigationGroups.flatMap((group) =>
  group.items.map((item) => ({ ...item, group: group.label }))
);

export const navPath = (label: string, path?: string) =>
  path ?? (label === "Overview" ? "/" : `/${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`);

export const navByPath = Object.fromEntries(navigationItems.map((item) => [navPath(item.label, item.path), item.label]));

export const plannedNavigationLabels = new Set(navigationItems.filter((item) => item.planned).map((item) => item.label));
