import { FormEvent, useEffect, useMemo, useState } from "react";
import { ActivitySquare, Play, Plus, RefreshCw } from "lucide-react";
import {
  createAlertRule,
  evaluateAlertRules,
  fetchAlertRules,
  fetchOrganizations,
  fetchServices,
  type AlertRuleRecord,
  type OrganizationRecord,
  type ServiceRecord
} from "../../shared/api/core";
import { EmptyState } from "../../shared/ui/EmptyState";

const severityClasses: Record<string, string> = {
  critical: "border-rose-500/40 bg-rose-500/10 text-rose-400",
  high: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  medium: "border-mint/40 bg-mint/10 text-mint",
  low: "border-mint/40 bg-mint/10 text-mint"
};

export function AlertRulesPage() {
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [rules, setRules] = useState<AlertRuleRecord[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [status, setStatus] = useState<string>();
  const [evaluation, setEvaluation] = useState<any>();

  const selectedOrgId = organizations[0]?.id ?? "";
  const selectedService = useMemo(() => services.find((service) => service.id === selectedServiceId), [services, selectedServiceId]);

  async function load() {
    const [orgs, serviceList, ruleList] = await Promise.all([fetchOrganizations(), fetchServices(), fetchAlertRules()]);
    setOrganizations(orgs);
    setServices(serviceList);
    setRules(ruleList);
    if (!selectedServiceId && serviceList[0]) setSelectedServiceId(serviceList[0].id);
  }

  useEffect(() => {
    load().catch((error) => setStatus(error instanceof Error ? error.message : "Failed to load alert rules"));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrgId) return;
    const form = new FormData(event.currentTarget);
    setStatus("creating alert rule");
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
      await load();
      setStatus("alert rule created");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "failed");
    }
  }

  async function runEvaluation() {
    if (!selectedOrgId || !selectedService) return;
    setStatus("evaluating rules");
    try {
      const result = await evaluateAlertRules({
        organizationId: selectedOrgId,
        projectId: selectedService.projectId,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        environment: "prod",
        timestamp: new Date().toISOString(),
        healthStatus: "down",
        metrics: {
          requestCount: 1200,
          errorCount: 84,
          errorRate: 7,
          avgLatencyMs: 620,
          p95LatencyMs: 1480,
          cpuUsage: 78,
          memoryUsage: 82
        }
      });
      setEvaluation(result);
      setStatus(result.breached > 0 ? "incident pipeline triggered" : "no threshold breach");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "failed");
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <form onSubmit={submit} className="rounded-lg border border-line bg-panel p-5 shadow-panel">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Alert Rules</h2>
            <p className="text-xs text-slate-400">Threshold evaluation</p>
          </div>
          <ActivitySquare className="h-5 w-5 text-amber" />
        </div>
        <div className="grid gap-3">
          <input name="name" required placeholder="Rule name" className="h-10 rounded-md border border-line bg-panel-soft px-3 text-sm" />
          <select name="serviceId" value={selectedServiceId} onChange={(event) => setSelectedServiceId(event.target.value)} className="h-10 rounded-md border border-line bg-panel-soft px-3 text-sm">
            {services.map((service) => (
              <option key={service.id} value={service.id}>{service.name}</option>
            ))}
          </select>
          <div className="grid gap-3 sm:grid-cols-2">
            <select name="metric" className="h-10 rounded-md border border-line bg-panel-soft px-3 text-sm">
              <option value="error_rate">error_rate</option>
              <option value="latency">latency</option>
              <option value="cpu">cpu</option>
              <option value="memory">memory</option>
              <option value="service_health">service_health</option>
            </select>
            <select name="operator" className="h-10 rounded-md border border-line bg-panel-soft px-3 text-sm">
              <option value="gt">gt</option>
              <option value="gte">gte</option>
              <option value="lt">lt</option>
              <option value="lte">lte</option>
              <option value="eq">eq</option>
            </select>
            <input name="threshold" type="number" step="0.01" defaultValue={5} className="h-10 rounded-md border border-line bg-panel-soft px-3 text-sm" />
            <input name="durationSeconds" type="number" defaultValue={300} className="h-10 rounded-md border border-line bg-panel-soft px-3 text-sm" />
          </div>
          <select name="severity" className="h-10 rounded-md border border-line bg-panel-soft px-3 text-sm">
            <option value="critical">critical</option>
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
          </select>
          <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-amber px-4 text-sm font-semibold text-slate-950">
            <Plus className="h-4 w-4" />
            Create Rule
          </button>
        </div>
      </form>

      <div className="space-y-4">
        <div className="rounded-lg border border-line bg-panel p-5 shadow-panel">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">Rules</h3>
            <div className="flex gap-2">
              <button onClick={() => load()} title="Refresh" className="grid h-9 w-9 place-items-center rounded-md border border-line bg-panel-soft text-slate-300">
                <RefreshCw className="h-4 w-4" />
              </button>
              <button onClick={runEvaluation} className="inline-flex h-9 items-center gap-2 rounded-md bg-mint px-3 text-xs font-semibold text-slate-950">
                <Play className="h-4 w-4" />
                Evaluate
              </button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {rules.map((rule) => (
              <div key={rule.id} className="rounded-lg border border-line bg-panel-soft p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{rule.name}</p>
                    <p className="mt-1 font-mono text-xs text-slate-400">{rule.metric} {rule.operator} {rule.threshold}</p>
                  </div>
                  <span className={`rounded border px-2 py-0.5 text-[10px] uppercase ${severityClasses[rule.severity] ?? severityClasses.medium}`}>
                    {rule.severity}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{rule.enabled ? "enabled" : "disabled"} · {rule.durationSeconds}s</p>
              </div>
            ))}
            {rules.length === 0 ? <EmptyState title="No alert rules yet" /> : null}
          </div>
        </div>

        {status ? <p className="text-sm text-slate-300">{status}</p> : null}
        {evaluation ? (
          <pre className="max-h-60 overflow-auto rounded-lg border border-line bg-panel-soft p-4 text-xs text-slate-300">
            {JSON.stringify(evaluation, null, 2)}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
