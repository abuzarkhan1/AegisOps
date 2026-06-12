import { FormEvent, useEffect, useMemo, useState } from "react";
import { ActivitySquare, Play, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  createAlertRule,
  deleteAlertRule,
  evaluateAlertRules,
  evaluateLogAlertRules,
  fetchAlertRules,
  fetchLogs,
  fetchMetricAggregates,
  fetchOrganizations,
  fetchServices,
  updateAlertRule,
  type AlertRuleRecord,
  type MetricAggregateRecord,
  type OrganizationRecord,
  type ServiceRecord
} from "../../shared/api/core";
import { useWorkspace } from "../../app/workspace";
import { StatusBadge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { Card, StatCard } from "../../shared/ui/Card";
import { Input, Select } from "../../shared/ui/FormControls";
import { EmptyState } from "../../shared/ui/EmptyState";

const severityClasses: Record<string, string> = {
  critical: "border-rose-500/40 bg-rose-500/10 text-rose-400",
  high: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  medium: "border-white/25 bg-white/10 text-white",
  low: "border-white/25 bg-white/10 text-white"
};

const numberValue = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : Number(value) || 0);

function metricsFromAggregates(aggregates: MetricAggregateRecord[], logs: any[]) {
  const errorLogs = logs.filter(
    (log) => numberValue(log.statusCode) >= 500 || ["error", "fatal"].includes(String(log.level).toLowerCase())
  ).length;
  const requestCount = logs.length || aggregates.reduce((sum, item) => sum + numberValue(item.count), 0);
  const latencyAggregates = aggregates.filter((item) => item.metricName.includes("latency") || item.metricName.includes("duration"));
  return {
    requestCount,
    errorCount: errorLogs,
    errorRate: requestCount ? (errorLogs / requestCount) * 100 : 0,
    avgLatencyMs: Math.max(0, ...latencyAggregates.map((item) => numberValue(item.avg))),
    p95LatencyMs: Math.max(0, ...latencyAggregates.map((item) => numberValue(item.p95))),
    p99LatencyMs: Math.max(0, ...latencyAggregates.map((item) => numberValue(item.p99)))
  };
}

function recommendedRulesFor(service?: ServiceRecord) {
  const type = service?.serviceType ?? "api";
  if (type === "worker") {
    return [
      { name: "Failed jobs > 10 in 5 minutes", metric: "log_error", operator: "gt", threshold: 10, durationSeconds: 300, severity: "high" },
      {
        name: "Queue duration > 30000ms",
        metric: "p95LatencyMs",
        operator: "gt",
        threshold: 30000,
        durationSeconds: 300,
        severity: "medium"
      },
      {
        name: "No job processed for 15 minutes",
        metric: "service_health",
        operator: "eq",
        threshold: 0,
        durationSeconds: 900,
        severity: "medium"
      }
    ];
  }
  if (type === "cache") {
    return [
      { name: "Cache hit ratio < 70%", metric: "cache_hit_ratio", operator: "lt", threshold: 70, durationSeconds: 300, severity: "medium" },
      { name: "Memory usage > 80%", metric: "memory_usage_percent", operator: "gt", threshold: 80, durationSeconds: 300, severity: "high" }
    ];
  }
  if (type === "database") {
    return [
      { name: "Query latency > 1000ms", metric: "p95LatencyMs", operator: "gt", threshold: 1000, durationSeconds: 300, severity: "high" },
      {
        name: "Connection usage > 80%",
        metric: "connection_usage_percent",
        operator: "gt",
        threshold: 80,
        durationSeconds: 300,
        severity: "medium"
      }
    ];
  }
  return [
    { name: "Error rate > 5% for 5 minutes", metric: "error_rate", operator: "gt", threshold: 5, durationSeconds: 300, severity: "high" },
    {
      name: "P95 latency > 2000ms for 10 minutes",
      metric: "p95LatencyMs",
      operator: "gt",
      threshold: 2000,
      durationSeconds: 600,
      severity: "high"
    },
    { name: "5xx errors > 20 in 5 minutes", metric: "log_error", operator: "gt", threshold: 20, durationSeconds: 300, severity: "medium" },
    {
      name: "No telemetry received for 15 minutes",
      metric: "service_health",
      operator: "eq",
      threshold: 0,
      durationSeconds: 900,
      severity: "medium"
    }
  ];
}

export function AlertRulesPage() {
  const { environment, fromIso } = useWorkspace();
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [rules, setRules] = useState<AlertRuleRecord[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [status, setStatus] = useState("");
  const [evaluation, setEvaluation] = useState<any>();
  const [loading, setLoading] = useState(false);

  const selectedService = useMemo(() => services.find((service) => service.id === selectedServiceId), [services, selectedServiceId]);
  const scopedRules = rules.filter((rule) => !selectedOrgId || rule.organizationId === selectedOrgId);
  const enabledRules = scopedRules.filter((rule) => rule.enabled);

  async function load(nextOrgId = selectedOrgId) {
    setLoading(true);
    setStatus("");
    try {
      const [orgs, serviceList, ruleList] = await Promise.all([fetchOrganizations(), fetchServices(), fetchAlertRules()]);
      const orgId = nextOrgId || orgs[0]?.id || "";
      const orgServices = orgId ? serviceList.filter((service) => service.organizationId === orgId) : serviceList;
      setOrganizations(orgs);
      setServices(orgServices);
      setRules(ruleList);
      setSelectedOrgId(orgId);
      if (!selectedServiceId || !orgServices.some((service) => service.id === selectedServiceId)) {
        setSelectedServiceId(orgServices[0]?.id || "");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load alert rules");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrgId) return;
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setStatus("Creating alert rule");
    try {
      await createAlertRule({
        organizationId: selectedOrgId,
        serviceId: String(form.get("serviceId") ?? ""),
        name: String(form.get("name") ?? ""),
        metric: String(form.get("metric") ?? "error_rate"),
        operator: String(form.get("operator") ?? "gt"),
        threshold: Number(form.get("threshold") ?? 0),
        durationSeconds: Number(form.get("durationSeconds") ?? 300),
        severity: String(form.get("severity") ?? "high"),
        enabled: true
      });
      event.currentTarget.reset();
      await load(selectedOrgId);
      setStatus("Alert rule created");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Create alert rule failed");
    } finally {
      setLoading(false);
    }
  }

  async function runEvaluation() {
    if (!selectedOrgId || !selectedService) {
      setStatus("Select an organization and service before evaluating rules.");
      return;
    }
    setLoading(true);
    setStatus("Evaluating metric rules");
    try {
      const [aggregateRows, logRows] = await Promise.all([
        fetchMetricAggregates({ serviceId: selectedService.id, environment, from: fromIso, limit: 200 }),
        fetchLogs({ serviceId: selectedService.id, environment, from: fromIso, limit: 200 })
      ]);
      const result = await evaluateAlertRules({
        organizationId: selectedOrgId,
        projectId: selectedService.projectId,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        environment,
        timestamp: new Date().toISOString(),
        healthStatus: selectedService.healthStatus,
        metrics: metricsFromAggregates(aggregateRows, logRows)
      });
      setEvaluation(result);
      setStatus(result.breached > 0 ? "Metric evaluation breached rules" : "Metric evaluation passed");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Metric evaluation failed");
    } finally {
      setLoading(false);
    }
  }

  async function runLogEvaluation() {
    if (!selectedOrgId || !selectedService) {
      setStatus("Select an organization and service before evaluating logs.");
      return;
    }
    setLoading(true);
    setStatus("Evaluating log rules");
    try {
      const logs = await fetchLogs({ serviceId: selectedService.id, environment, from: fromIso, limit: 50 });
      const log =
        logs.find((item) => ["error", "fatal"].includes(String(item.level).toLowerCase()) || numberValue(item.statusCode) >= 500) ??
        logs[0];
      if (!log) {
        setStatus("No logs available for this service and range");
        setEvaluation(undefined);
        return;
      }
      const result = await evaluateLogAlertRules({
        organizationId: selectedOrgId,
        projectId: selectedService.projectId,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        environment,
        level: log.level,
        message: log.message,
        traceId: log.traceId,
        requestId: log.requestId,
        route: log.route,
        statusCode: log.statusCode,
        metadata: log.metadata ?? {},
        timestamp: log.timestamp
      });
      setEvaluation(result);
      setStatus(result.breached > 0 ? "Log evaluation breached rules" : "Log evaluation passed");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Log evaluation failed");
    } finally {
      setLoading(false);
    }
  }

  async function toggleRule(rule: AlertRuleRecord) {
    setLoading(true);
    setStatus(rule.enabled ? "Disabling rule" : "Enabling rule");
    try {
      await updateAlertRule(rule.id, { enabled: !rule.enabled });
      await load(selectedOrgId);
      setStatus(rule.enabled ? "Rule disabled" : "Rule enabled");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Rule update failed");
    } finally {
      setLoading(false);
    }
  }

  async function removeRule(rule: AlertRuleRecord) {
    if (!window.confirm(`Delete alert rule "${rule.name}"?`)) return;
    setLoading(true);
    setStatus("Deleting rule");
    try {
      await deleteAlertRule(rule.id);
      await load(selectedOrgId);
      setStatus("Rule deleted");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Rule delete failed");
    } finally {
      setLoading(false);
    }
  }

  async function applyRecommendedRules() {
    if (!selectedOrgId || !selectedServiceId) {
      setStatus("Select an organization and service before applying recommended rules.");
      return;
    }
    setLoading(true);
    setStatus("Creating recommended alert rules");
    try {
      for (const rule of recommendedRulesFor(selectedService)) {
        await createAlertRule({
          organizationId: selectedOrgId,
          serviceId: selectedServiceId,
          ...rule,
          enabled: true
        });
      }
      await load(selectedOrgId);
      setStatus("Recommended alert rules created");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Recommended rule creation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Alert Rules</h2>
          <p className="mt-1 text-sm text-text-soft">Create, evaluate, toggle, and delete threshold rules using live telemetry.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={loading || !selectedServiceId} icon={<Play className="h-4 w-4" />} onClick={applyRecommendedRules}>
            Use recommended rules
          </Button>
          <Button disabled={loading} icon={<RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />} onClick={() => load()}>
            Refresh
          </Button>
        </div>
      </div>

      {status ? <div className="aegis-glass rounded-2xl p-3 text-sm text-text-soft">{status}</div> : null}

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Rules" value={scopedRules.length} detail="selected organization" />
        <StatCard label="Enabled" value={enabledRules.length} detail="actively evaluated" />
        <StatCard label="Services" value={services.length} detail={`environment view: ${environment}`} />
        <StatCard label="Last breached" value={evaluation?.breached ?? "-"} detail="most recent evaluation" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <form onSubmit={submit}>
          <Card
            title="Create Rule"
            description="Attach a threshold rule to a service."
            action={<ActivitySquare className="h-5 w-5 text-amber" />}
          >
            <div className="grid gap-3">
              <Select value={selectedOrgId} onChange={(event) => load(event.target.value)} aria-label="Organization">
                <option value="">Select organization</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </Select>
              <Input name="name" required placeholder="Rule name" />
              <Select
                name="serviceId"
                value={selectedServiceId}
                onChange={(event) => setSelectedServiceId(event.target.value)}
                aria-label="Service"
              >
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </Select>
              <div className="grid gap-3 sm:grid-cols-2">
                <Select name="metric" aria-label="Metric">
                  <option value="error_rate">error_rate</option>
                  <option value="p95LatencyMs">p95LatencyMs</option>
                  <option value="p99LatencyMs">p99LatencyMs</option>
                  <option value="service_health">service_health</option>
                  <option value="log_error">log_error</option>
                </Select>
                <Select name="operator" aria-label="Operator">
                  <option value="gt">gt</option>
                  <option value="gte">gte</option>
                  <option value="lt">lt</option>
                  <option value="lte">lte</option>
                  <option value="eq">eq</option>
                </Select>
                <Input name="threshold" type="number" step="0.01" defaultValue={5} />
                <Input name="durationSeconds" type="number" defaultValue={300} />
              </div>
              <Select name="severity" defaultValue="high" aria-label="Severity">
                <option value="critical">critical</option>
                <option value="high">high</option>
                <option value="medium">medium</option>
                <option value="low">low</option>
              </Select>
              <Button
                type="submit"
                variant="primary"
                disabled={loading || !selectedOrgId || !selectedServiceId}
                icon={<Plus className="h-4 w-4" />}
              >
                Create Rule
              </Button>
            </div>
          </Card>
        </form>

        <div className="space-y-4">
          <Card
            title="Rules"
            description="Evaluation reads metric aggregates and logs for the selected service and time range."
            action={
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={loading || !selectedServiceId} icon={<Play className="h-4 w-4" />} onClick={runEvaluation}>
                  Metrics
                </Button>
                <Button size="sm" disabled={loading || !selectedServiceId} icon={<Play className="h-4 w-4" />} onClick={runLogEvaluation}>
                  Logs
                </Button>
              </div>
            }
          >
            <div className="grid gap-3 md:grid-cols-2">
              {scopedRules.map((rule) => (
                <div key={rule.id} className="aegis-glass rounded-2xl p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{rule.name}</p>
                      <p className="mt-1 font-mono text-xs text-text-soft">
                        {rule.metric} {rule.operator} {rule.threshold}
                      </p>
                    </div>
                    <span
                      className={`rounded border px-2 py-0.5 text-[10px] uppercase ${severityClasses[rule.severity] ?? severityClasses.medium}`}
                    >
                      {rule.severity}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <StatusBadge status={rule.enabled ? "active" : "disabled"} />
                    <div className="flex gap-2">
                      <Button size="sm" disabled={loading} onClick={() => toggleRule(rule)}>
                        {rule.enabled ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={loading}
                        icon={<Trash2 className="h-4 w-4" />}
                        onClick={() => removeRule(rule)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {scopedRules.length === 0 ? (
                <div className="md:col-span-2">
                  <EmptyState
                    title="No alert rules configured"
                    description="Start with a simple rule like p95 latency > 2s or error rate > 5%."
                    action={
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="primary" disabled={loading || !selectedServiceId} onClick={applyRecommendedRules}>
                          Use recommended rules
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setStatus("Choose a service, then create p95 latency > 2000ms or error_rate > 5%.")}
                        >
                          View alert examples
                        </Button>
                      </div>
                    }
                  />
                </div>
              ) : null}
            </div>
          </Card>

          {evaluation ? (
            <pre className="max-h-80 overflow-auto aegis-glass rounded-2xl p-4 text-xs text-text-soft">
              {JSON.stringify(evaluation, null, 2)}
            </pre>
          ) : null}
        </div>
      </div>
    </div>
  );
}
