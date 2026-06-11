import { useEffect, useMemo, useState } from "react";
import { RadioTower, ShieldCheck } from "lucide-react";
import { coreApiUrl, gatewayUrl } from "./app/config";
import { AiRcaPage } from "./features/ai/AiRcaPage";
import { DeploymentsPage } from "./features/deployments/DeploymentsPage";
import { IncidentsPage } from "./features/incidents/IncidentsPage";
import { LogsPage } from "./features/logs/LogsPage";
import { MetricsPage } from "./features/metrics/MetricsPage";
import { NotificationsPage } from "./features/notifications/NotificationsPage";
import { OverviewPage } from "./features/overview/OverviewPage";
import { ProjectsPage } from "./features/projects/ProjectsPage";
import { AlertRulesPage } from "./features/alerts/AlertRulesPage";
import { ConnectProjectPage } from "./features/connect/ConnectProjectPage";
import { ServicesPage } from "./features/services/ServicesPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { ReportsPage } from "./features/reports/ReportsPage";
import { TeamMembersPage } from "./features/team/TeamMembersPage";
import { ShellLayout } from "./layouts/ShellLayout";
import { navigationItems } from "./app/navigation";
import { fetchHealthTarget } from "./shared/api/health";
import type { HealthResult, HealthState } from "./shared/api/health";

const healthTargets = [
  { name: "Gateway", url: `${gatewayUrl}/health`, icon: ShieldCheck },
  { name: "Core API", url: `${coreApiUrl}/health`, icon: RadioTower }
];

const navPath = (label: string, path?: string) =>
  path ?? (label === "Overview" ? "/" : `/${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`);
const navByPath = Object.fromEntries(navigationItems.map((item) => [navPath(item.label, item.path), item.label]));
const labelFromLocation = () => navByPath[window.location.pathname] ?? "Overview";

function App() {
  const [activeNav, setActiveNav] = useState(labelFromLocation);
  const [health, setHealth] = useState<Record<string, HealthResult>>({});

  const handleNavChange = (label: string) => {
    const item = navigationItems.find((navItem) => navItem.label === label);
    const path = navPath(label, item?.path);
    setActiveNav(label);
    if (window.location.pathname !== path) {
      window.history.pushState(null, "", path);
    }
  };

  useEffect(() => {
    const onPopState = () => setActiveNav(labelFromLocation());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadHealth() {
      const results = await Promise.all(healthTargets.map((target) => fetchHealthTarget(target, controller.signal)));

      if (!controller.signal.aborted) {
        setHealth(Object.fromEntries(results));
      }
    }

    loadHealth();
    const timer = window.setInterval(loadHealth, 15000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, []);

  const healthyCount = useMemo(
    () => Object.values(health).filter((item) => item.status === "ok").length,
    [health]
  );
  const shellStatus: HealthState = healthyCount === healthTargets.length ? "ok" : "degraded";

  return (
    <ShellLayout activeNav={activeNav} onNavChange={handleNavChange} status={shellStatus}>
      {activeNav === "Overview" ? <OverviewPage health={health} onNavigate={handleNavChange} /> : null}
      {activeNav === "Connect Project" ? <ConnectProjectPage onNavigate={handleNavChange} /> : null}
      {activeNav === "Projects" ? <ProjectsPage /> : null}
      {activeNav === "Services" ? <ServicesPage /> : null}
      {activeNav === "Alert Rules" ? <AlertRulesPage /> : null}
      {activeNav === "Incidents" ? <IncidentsPage /> : null}
      {activeNav === "Logs" ? <LogsPage /> : null}
      {activeNav === "Metrics" ? <MetricsPage /> : null}
      {activeNav === "Deployments" ? <DeploymentsPage /> : null}
      {activeNav === "Reports" ? <ReportsPage /> : null}
      {activeNav === "AI RCA" ? <AiRcaPage /> : null}
      {activeNav === "Notifications" ? <NotificationsPage /> : null}
      {activeNav === "Team" ? <TeamMembersPage /> : null}
      {activeNav === "Settings" ? <SettingsPage /> : null}
    </ShellLayout>
  );
}

export default App;
