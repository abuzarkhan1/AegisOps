import { CheckCircle2, Circle, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys, queryStaleTimes } from "../../app/queryClient";
import { fetchAlertRules, fetchApiKeys, fetchDashboardSummary, fetchIncidents, fetchProjects, fetchServices } from "../api/core";
import { Button } from "./Button";
import { ProgressBar } from "./Progress";

type SetupStatus = {
  projectCreated: boolean;
  serviceCreated: boolean;
  apiKeyGenerated: boolean;
  firstLogReceived: boolean;
  firstMetricReceived: boolean;
  alertRuleCreated: boolean;
  firstIncidentCreated: boolean;
};

type ChecklistItem = {
  key: keyof SetupStatus | "installSdk";
  label: string;
  action: string;
  nav: string;
};

const items: ChecklistItem[] = [
  { key: "projectCreated", label: "Create your first project", action: "Connect", nav: "Connect Project" },
  { key: "serviceCreated", label: "Add a service", action: "Add service", nav: "Connect Project" },
  { key: "apiKeyGenerated", label: "Generate API key", action: "API keys", nav: "Connect Project" },
  { key: "installSdk", label: "Install SDK or send test event", action: "Guide", nav: "Connect Project" },
  { key: "firstLogReceived", label: "Receive first log", action: "Logs", nav: "Logs" },
  { key: "firstMetricReceived", label: "Receive first metric", action: "Metrics", nav: "Metrics" },
  { key: "alertRuleCreated", label: "Create first alert rule", action: "Rules", nav: "Alert Rules" },
  { key: "firstIncidentCreated", label: "View first incident/RCA", action: "Incidents", nav: "Incidents" }
];

async function fetchSetupStatus(): Promise<SetupStatus> {
  const summary = await fetchDashboardSummary();
  const projects = await fetchProjects();
  const services = await fetchServices();
  const apiKeys = await fetchApiKeys();
  const alertRules = await fetchAlertRules();
  const incidents = await fetchIncidents();

  return {
    projectCreated: projects.length > 0,
    serviceCreated: services.length > 0,
    apiKeyGenerated: apiKeys.length > 0,
    firstLogReceived: Number(summary.logsIngested ?? 0) > 0,
    firstMetricReceived: Number(summary.metricsIngested ?? 0) > 0,
    alertRuleCreated: alertRules.length > 0,
    firstIncidentCreated: incidents.length > 0
  };
}

export function SetupChecklist({ onNavigate }: { onNavigate?: (label: string) => void }) {
  const [dismissed, setDismissed] = useState(false);
  const {
    data: status,
    isFetching,
    refetch
  } = useQuery({
    queryKey: queryKeys.setupStatus(),
    queryFn: fetchSetupStatus,
    staleTime: queryStaleTimes.overview
  });

  const completedCount = useMemo(() => {
    if (!status) return 0;
    const isDone = (item: ChecklistItem) => (item.key === "installSdk" ? status.apiKeyGenerated : status[item.key]);
    return items.filter(isDone).length;
  }, [status]);

  if (!status || dismissed || completedCount === items.length) return null;
  const completionPercent = (completedCount / items.length) * 100;

  return (
    <section className="rounded-lg border border-line bg-panel p-4 shadow-panel">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Setup checklist</h2>
          <p className="mt-1 text-sm text-text-soft">
            {completedCount} of {items.length} steps complete. AegisOps will collapse this once your workspace is fully set up.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={isFetching}
            icon={<RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />}
            onClick={() => refetch()}
          >
            Refresh
          </Button>
          <Button size="sm" onClick={() => setDismissed(true)}>
            Hide
          </Button>
        </div>
      </div>
      <ProgressBar value={completionPercent} className="mb-4" />
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => {
          const itemDone = (candidate: ChecklistItem) => (candidate.key === "installSdk" ? status.apiKeyGenerated : status[candidate.key]);
          const done = itemDone(item);
          const current = !done && items.find((candidate) => !itemDone(candidate))?.key === item.key;
          return (
            <div
              key={item.key}
              className={`rounded-lg border p-4 ${done ? "border-white/20 bg-panel-hover" : current ? "border-amber/40 bg-amber/10" : "border-line bg-panel-soft"}`}
            >
              <div className="flex items-start gap-2">
                {done ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-white" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{item.label}</p>
                  <p className="mt-1 text-xs text-text-muted">{done ? "Completed" : current ? "Current step" : "Pending"}</p>
                </div>
              </div>
              {!done ? (
                <Button
                  className="mt-3 w-full"
                  size="sm"
                  variant={current ? "primary" : "secondary"}
                  onClick={() => onNavigate?.(item.nav)}
                >
                  {item.action}
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
