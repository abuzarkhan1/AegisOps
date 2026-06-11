import { useEffect, useMemo, useState } from "react";
import { RadioTower, ShieldCheck } from "lucide-react";
import { coreApiUrl, gatewayUrl } from "./config";
import { navByPath, navigationItems, navPath } from "./navigation";
import { RouteView } from "./router";
import { AppShell } from "../shared/layout/AppShell";
import { fetchHealthTarget } from "../shared/api/health";
import type { HealthResult, HealthState } from "../shared/api/health";

const healthTargets = [
  { name: "Gateway", url: `${gatewayUrl}/health`, icon: ShieldCheck },
  { name: "Core API", url: `${coreApiUrl}/health`, icon: RadioTower }
];

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
    <AppShell activeNav={activeNav} onNavChange={handleNavChange} status={shellStatus}>
      <RouteView activeNav={activeNav} health={health} onNavigate={handleNavChange} />
    </AppShell>
  );
}

export default App;
