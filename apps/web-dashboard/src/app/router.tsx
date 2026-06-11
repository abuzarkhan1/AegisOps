import { lazy, Suspense } from "react";
import type { ComponentType } from "react";
import type { HealthResult } from "../shared/api/health";
import { plannedNavigationLabels } from "./navigation";
import { PageSkeleton } from "../shared/ui/LoadingSkeleton";
import { PlaceholderPage } from "../shared/ui/PlaceholderPage";
import { ErrorBoundary } from "./ErrorBoundary";

type RoutePageProps = {
  health?: Record<string, HealthResult>;
  onNavigate?: (label: string) => void;
};

type RouteDefinition = {
  label: string;
  component: ComponentType<RoutePageProps>;
};

const route = <T extends Record<string, any>>(loader: () => Promise<T>, exportName: keyof T) =>
  lazy(async () => ({ default: (await loader())[exportName] as ComponentType<RoutePageProps> }));

const OverviewPage = route(() => import("../features/overview/OverviewPage"), "OverviewPage");
const ConnectProjectPage = route(() => import("../features/connect/ConnectProjectPage"), "ConnectProjectPage");
const ProjectsPage = route(() => import("../features/projects/ProjectsPage"), "ProjectsPage");
const ServicesPage = route(() => import("../features/services/ServicesPage"), "ServicesPage");
const ApiKeysPage = route(() => import("../features/api-keys/ApiKeysPage"), "ApiKeysPage");
const AlertRulesPage = route(() => import("../features/alerts/AlertRulesPage"), "AlertRulesPage");
const IncidentsPage = route(() => import("../features/incidents/IncidentsPage"), "IncidentsPage");
const LogsPage = route(() => import("../features/logs/LogsPage"), "LogsPage");
const MetricsPage = route(() => import("../features/metrics/MetricsPage"), "MetricsPage");
const DeploymentsPage = route(() => import("../features/deployments/DeploymentsPage"), "DeploymentsPage");
const ReportsPage = route(() => import("../features/reports/ReportsPage"), "ReportsPage");
const AiRcaPage = route(() => import("../features/ai/AiRcaPage"), "AiRcaPage");
const NotificationsPage = route(() => import("../features/notifications/NotificationsPage"), "NotificationsPage");
const TeamMembersPage = route(() => import("../features/team/TeamMembersPage"), "TeamMembersPage");
const AuditLogsPage = route(() => import("../features/audit/AuditLogsPage"), "AuditLogsPage");
const SettingsPage = route(() => import("../features/settings/SettingsPage"), "SettingsPage");

const routeDefinitions: RouteDefinition[] = [
  { label: "Overview", component: OverviewPage },
  { label: "Connect Project", component: ConnectProjectPage },
  { label: "Projects", component: ProjectsPage },
  { label: "Services", component: ServicesPage },
  { label: "API Keys", component: ApiKeysPage },
  { label: "Alert Rules", component: AlertRulesPage },
  { label: "Incidents", component: IncidentsPage },
  { label: "Logs", component: LogsPage },
  { label: "Metrics", component: MetricsPage },
  { label: "Deployments", component: DeploymentsPage },
  { label: "Reports", component: ReportsPage },
  { label: "AI RCA", component: AiRcaPage },
  { label: "Notifications", component: NotificationsPage },
  { label: "Team", component: TeamMembersPage },
  { label: "Audit Logs", component: AuditLogsPage },
  { label: "Settings", component: SettingsPage }
];

export function RouteView({ activeNav, health, onNavigate }: { activeNav: string; health: Record<string, HealthResult>; onNavigate: (label: string) => void }) {
  if (plannedNavigationLabels.has(activeNav)) {
    return <PlaceholderPage title={activeNav} />;
  }

  const routeDefinition = routeDefinitions.find((item) => item.label === activeNav) ?? routeDefinitions[0];
  const Page = routeDefinition.component;

  return (
    <ErrorBoundary key={activeNav}>
      <Suspense fallback={<PageSkeleton />}>
        <Page health={health} onNavigate={onNavigate} />
      </Suspense>
    </ErrorBoundary>
  );
}
