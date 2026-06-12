import { useEffect, useMemo, useState } from "react";
import { AlertCircle, FileWarning, RefreshCw, ShieldAlert } from "lucide-react";
import {
  fetchAlertRules,
  fetchIncidents,
  fetchLogs,
  fetchServices,
  type AlertRuleRecord,
  type IncidentRecord,
  type ServiceRecord
} from "../../shared/api/core";
import { useWorkspace } from "../../app/workspace";
import { Button } from "../../shared/ui/Button";
import { Card, StatCard } from "../../shared/ui/Card";
import { SeverityBadge, StatusBadge } from "../../shared/ui/Badge";

type IssueRow = {
  id: string;
  type: "incident" | "log" | "alert";
  title: string;
  severity: string;
  status: string;
  serviceId?: string;
  serviceName?: string;
  createdAt?: string;
  detail?: string;
};

const issueTone = (type: IssueRow["type"]) => (type === "incident" ? "text-rose" : type === "log" ? "text-amber" : "text-white");

export function IssuesPage() {
  const { environment, fromIso } = useWorkspace();
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [rules, setRules] = useState<AlertRuleRecord[]>([]);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [typeFilter, setTypeFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [incidentRows, logRows, ruleRows, serviceRows] = await Promise.all([
        fetchIncidents(),
        fetchLogs({ level: "error", environment, from: fromIso, limit: 50 }),
        fetchAlertRules({ enabled: "true" }),
        fetchServices()
      ]);
      setIncidents(incidentRows);
      setLogs(logRows);
      setRules(ruleRows);
      setServices(serviceRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load issues");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [environment, fromIso]);

  const servicesById = useMemo(() => new Map(services.map((service) => [service.id, service])), [services]);
  const issues = useMemo<IssueRow[]>(() => {
    const incidentIssues = incidents
      .filter((incident) => !["resolved", "closed"].includes(incident.status))
      .map((incident) => ({
        id: incident.id,
        type: "incident" as const,
        title: incident.title,
        severity: incident.severity,
        status: incident.status,
        serviceId: incident.serviceId,
        serviceName: incident.serviceId ? servicesById.get(incident.serviceId)?.name : undefined,
        createdAt: incident.createdAt,
        detail: incident.summary
      }));
    const logIssues = logs.map((log) => ({
      id: log.id ?? `${log.traceId}-${log.timestamp}`,
      type: "log" as const,
      title: log.message ?? "Error log",
      severity: log.statusCode >= 500 ? "high" : "medium",
      status: String(log.statusCode ?? log.level ?? "error"),
      serviceId: log.serviceId,
      serviceName: log.serviceName,
      createdAt: log.timestamp,
      detail: `${log.route ?? "unknown route"} ${log.traceId ?? ""}`.trim()
    }));
    const alertIssues = rules
      .filter((rule) => rule.enabled)
      .map((rule) => ({
        id: rule.id,
        type: "alert" as const,
        title: rule.name,
        severity: rule.severity,
        status: `${rule.metric} ${rule.operator} ${rule.threshold}`,
        serviceId: rule.serviceId,
        serviceName: rule.serviceId ? servicesById.get(rule.serviceId)?.name : undefined,
        detail: `${rule.durationSeconds}s window`
      }));
    return [...incidentIssues, ...logIssues, ...alertIssues].filter((issue) => typeFilter === "all" || issue.type === typeFilter);
  }, [incidents, logs, rules, servicesById, typeFilter]);

  const critical = issues.filter((issue) => issue.severity === "critical").length;
  const high = issues.filter((issue) => issue.severity === "high").length;
  const affectedServices = new Set(issues.map((issue) => issue.serviceId ?? issue.serviceName).filter(Boolean)).size;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Issues</h2>
          <p className="mt-1 text-sm text-text-soft">Unified queue from active incidents, alert rules, and error logs.</p>
        </div>
        <Button icon={<RefreshCw className="h-4 w-4" />} disabled={loading} onClick={load}>
          Refresh
        </Button>
      </div>
      {error ? <div className="rounded-2xl border border-rose/40 bg-rose/10 p-3 text-sm text-rose">{error}</div> : null}

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Open issues" value={issues.length} detail={`environment: ${environment}`} />
        <StatCard label="Critical" value={critical} detail="highest severity" />
        <StatCard label="High" value={high} detail="needs triage" />
        <StatCard label="Affected services" value={affectedServices} detail="unique service refs" />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {["all", "incident", "log", "alert"].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setTypeFilter(type)}
                className={`h-9 rounded-full border px-3 text-xs font-semibold ${typeFilter === type ? "border-white/40 bg-white/10 text-white" : "border-white/10 bg-white/5 text-text-soft hover:text-white"}`}
              >
                {type}
              </button>
            ))}
          </div>
          <p className="text-xs text-text-muted">Error logs since {new Date(fromIso).toLocaleString()}</p>
        </div>
      </Card>

      <div className="grid gap-3">
        {issues.map((issue) => (
          <Card key={`${issue.type}-${issue.id}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {issue.type === "incident" ? (
                    <ShieldAlert className={`h-4 w-4 ${issueTone(issue.type)}`} />
                  ) : issue.type === "log" ? (
                    <FileWarning className={`h-4 w-4 ${issueTone(issue.type)}`} />
                  ) : (
                    <AlertCircle className={`h-4 w-4 ${issueTone(issue.type)}`} />
                  )}
                  <h3 className="truncate text-sm font-semibold text-white">{issue.title}</h3>
                  <SeverityBadge severity={issue.severity} />
                  <StatusBadge status={issue.status} />
                </div>
                <p className="mt-2 text-sm text-text-soft">
                  {issue.serviceName ?? "unmapped service"} {issue.detail ? `/ ${issue.detail}` : ""}
                </p>
              </div>
              <span className="rounded-2xl border border-white/10 bg-white/5 px-2 py-1 text-xs text-text-soft">{issue.type}</span>
            </div>
          </Card>
        ))}
        {issues.length === 0 ? (
          <Card>
            <p className="text-sm text-text-muted">No issues matched the active workspace filters.</p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
