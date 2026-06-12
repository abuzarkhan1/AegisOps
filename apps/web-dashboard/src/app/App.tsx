import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { RadioTower, ShieldCheck } from "lucide-react";
import { AuthPage } from "./AuthPage";
import { useAuth } from "./auth";
import { coreApiUrl, gatewayUrl } from "./config";
import { navByPath, navigationItems, navPath } from "./navigation";
import { OnboardingRouteView, PublicRouteView, publicRouteDefinitions, RouteView } from "./router";
import { WorkspaceProvider } from "./workspace";
import { fetchHealthTarget } from "../shared/api/health";
import type { HealthResult, HealthState } from "../shared/api/health";
import { DashboardLayout } from "../shared/layout/DashboardLayout";
import { OnboardingLayout } from "../shared/layout/OnboardingLayout";
import { PublicLayout } from "../shared/layout/PublicLayout";

const healthTargets = [
  { name: "Gateway", url: `${gatewayUrl}/health`, icon: ShieldCheck },
  { name: "Core API", url: `${coreApiUrl}/health`, icon: RadioTower }
];

const labelFromPath = (path: string) => navByPath[path] ?? "Overview";
const publicPaths = new Set(publicRouteDefinitions.map((route) => route.path));
const authPublicPaths = new Set(["/login", "/register"]);

function App() {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const activeNav = labelFromPath(path);
  const [health, setHealth] = useState<Record<string, HealthResult>>({});

  const navigatePath = useCallback((nextPath: string, replace = false) => navigate(nextPath, { replace }), [navigate]);

  const handleNavChange = useCallback(
    (label: string) => {
      const item = navigationItems.find((navItem) => navItem.label === label);
      navigatePath(navPath(label, item?.path));
    },
    [navigatePath]
  );

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

  const healthyCount = useMemo(() => Object.values(health).filter((item) => item.status === "ok").length, [health]);
  const shellStatus: HealthState = healthyCount === healthTargets.length ? "ok" : "degraded";

  const isPublicPath = publicPaths.has(path);
  const isOnboardingPath = path === "/onboarding";

  useEffect(() => {
    const pageName = isOnboardingPath
      ? "Onboarding"
      : isPublicPath
        ? publicRouteDefinitions.find((route) => route.path === path)?.path.replace("/", "")
        : activeNav;
    const title = pageName ? `${pageName === "" ? "Home" : pageName.replace(/-/g, " ")} | AegisOps` : "AegisOps";
    document.title = title.replace(/\b\w/g, (letter) => letter.toUpperCase());
  }, [activeNav, isOnboardingPath, isPublicPath, path]);

  const onAuthenticated = (mode: "login" | "register") => {
    navigatePath(mode === "register" ? "/onboarding" : "/overview");
  };

  if (isPublicPath) {
    if (authPublicPaths.has(path)) {
      return <PublicRouteView path={path} onAuthenticated={onAuthenticated} />;
    }

    return (
      <PublicLayout activePath={path}>
        <PublicRouteView path={path} onAuthenticated={onAuthenticated} />
      </PublicLayout>
    );
  }

  if (auth.status === "loading") {
    return (
      <div className="grid min-h-screen place-items-center bg-shell text-text-primary">
        <div className="aegis-glass rounded-2xl p-5 text-sm text-text-soft shadow-panel">Loading secure workspace</div>
      </div>
    );
  }

  if (auth.status === "anonymous") {
    return <AuthPage initialMode={isOnboardingPath ? "register" : "login"} onAuthenticated={onAuthenticated} />;
  }

  if (isOnboardingPath) {
    return (
      <OnboardingLayout>
        <OnboardingRouteView onNavigate={handleNavChange} />
      </OnboardingLayout>
    );
  }

  return (
    <WorkspaceProvider>
      <DashboardLayout activeNav={activeNav} onNavChange={handleNavChange} status={shellStatus}>
        <RouteView activeNav={activeNav} health={health} onNavigate={handleNavChange} />
      </DashboardLayout>
    </WorkspaceProvider>
  );
}

export default App;
