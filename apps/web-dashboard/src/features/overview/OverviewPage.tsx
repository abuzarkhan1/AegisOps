import { RadioTower, ShieldCheck } from "lucide-react";
import type { HealthResult } from "../../shared/api/health";
import { GatewayRoutesPanel } from "./components/GatewayRoutesPanel";
import { SecurityPosturePanel } from "./components/SecurityPosturePanel";
import { ServiceHealthPanel } from "./components/ServiceHealthPanel";

const serviceTargets = [
  { name: "Gateway", icon: ShieldCheck },
  { name: "Core API", icon: RadioTower }
];

export function OverviewPage({ health }: { health: Record<string, HealthResult> }) {
  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <ServiceHealthPanel targets={serviceTargets} health={health} />
        <SecurityPosturePanel />
      </div>
      <GatewayRoutesPanel />
    </>
  );
}

