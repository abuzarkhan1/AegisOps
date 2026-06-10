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
import { ServicesPage } from "./features/services/ServicesPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { ReportsPage } from "./features/reports/ReportsPage";
import { TeamMembersPage } from "./features/team/TeamMembersPage";
import { ShellLayout } from "./layouts/ShellLayout";
import { fetchHealthTarget } from "./shared/api/health";
import type { HealthResult, HealthState } from "./shared/api/health";

const healthTargets = [
  { name: "Gateway", url: `${gatewayUrl}/health`, icon: ShieldCheck },
  { name: "Core API", url: `${coreApiUrl}/health`, icon: RadioTower }
];

function App() {
  const [activeNav, setActiveNav] = useState("Overview");
  const [health, setHealth] = useState<Record<string, HealthResult>>({});

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
    <ShellLayout activeNav={activeNav} onNavChange={setActiveNav} status={shellStatus}>
      {activeNav === "Overview" ? <OverviewPage health={health} /> : null}
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
