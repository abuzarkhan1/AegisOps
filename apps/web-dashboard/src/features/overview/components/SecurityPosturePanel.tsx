import { LockKeyhole } from "lucide-react";
import { MetricRow } from "../../../shared/ui/MetricRow";

export function SecurityPosturePanel() {
  return (
    <div className="aegis-glass rounded-2xl p-4 shadow-panel">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Security Posture</h2>
          <p className="text-sm text-text-soft">Runtime boundary snapshot</p>
        </div>
        <LockKeyhole className="h-5 w-5 text-amber" aria-hidden="true" />
      </div>
      <div className="space-y-3 text-sm text-text-soft">
        <MetricRow label="Gateway Port" value="8080" />
        <MetricRow label="Kafka External" value="9094" />
        <MetricRow label="Grafana" value="3000" />
        <MetricRow label="RabbitMQ UI" value="15672" />
      </div>
    </div>
  );
}
