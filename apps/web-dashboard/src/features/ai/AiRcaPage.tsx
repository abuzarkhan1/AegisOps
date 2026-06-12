import { BrainCircuit, RefreshCw, Save, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  analyzeIncident,
  fetchDeployments,
  fetchIncidents,
  fetchLogs,
  fetchMetricAggregates,
  fetchServices,
  saveIncidentAnalysis,
  summarizeLogs,
  type DeploymentRecord,
  type IncidentRecord,
  type MetricAggregateRecord,
  type ServiceRecord
} from "../../shared/api/core";
import { useWorkspace } from "../../app/workspace";
import { SeverityBadge, StatusBadge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { Card, StatCard } from "../../shared/ui/Card";
import { Select, Textarea } from "../../shared/ui/FormControls";

const numberValue = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : Number(value) || 0);

export function AiRcaPage() {
  const { environment, fromIso } = useWorkspace();
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [aggregates, setAggregates] = useState<MetricAggregateRecord[]>([]);
  const [incidentId, setIncidentId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [operatorNotes, setOperatorNotes] = useState("");
  const [result, setResult] = useState<Record<string, unknown>>();
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedIncident = incidents.find((incident) => incident.id === incidentId);
  const selectedService = services.find((service) => service.id === (selectedIncident?.serviceId || serviceId));
  const selectedDeployment = deployments.find((deployment) => deployment.serviceName === selectedService?.name);

  const metricsSummary = useMemo(() => {
    const p95Values = aggregates.map((item) => numberValue(item.p95)).filter((value) => value > 0);
    const errorValues = aggregates.filter((item) => item.metricName.includes("error")).map((item) => numberValue(item.avg));
    return {
      p95LatencyMs: p95Values.length ? Math.max(...p95Values) : 0,
      errorRate: errorValues.length ? Math.max(...errorValues) : 0,
      samples: aggregates.reduce((sum, item) => sum + numberValue(item.count), 0)
    };
  }, [aggregates]);

  async function load() {
    setLoading(true);
    setStatus("");
    try {
      const [incidentRows, serviceRows, deploymentRows] = await Promise.all([fetchIncidents(), fetchServices(), fetchDeployments()]);
      const envServices = serviceRows.filter((service) => service.environment === environment);
      setIncidents(incidentRows);
      setServices(envServices.length ? envServices : serviceRows);
      setDeployments(deploymentRows.filter((deployment) => deployment.environment === environment));
      const firstIncident = incidentRows.find((incident) => !["resolved", "closed"].includes(incident.status)) ?? incidentRows[0];
      const nextIncidentId = incidentId || firstIncident?.id || "";
      const nextServiceId = serviceId || firstIncident?.serviceId || envServices[0]?.id || serviceRows[0]?.id || "";
      setIncidentId(nextIncidentId);
      setServiceId(nextServiceId);
      if (nextServiceId) {
        const [logRows, aggregateRows] = await Promise.all([
          fetchLogs({ serviceId: nextServiceId, environment, from: fromIso, limit: 50 }),
          fetchMetricAggregates({ serviceId: nextServiceId, environment, from: fromIso, limit: 100 })
        ]);
        setLogs(logRows);
        setAggregates(aggregateRows);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load AI RCA context");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [environment, fromIso]);

  useEffect(() => {
    const nextServiceId = selectedIncident?.serviceId || serviceId;
    if (!nextServiceId) return;
    Promise.all([
      fetchLogs({ serviceId: nextServiceId, environment, from: fromIso, limit: 50 }),
      fetchMetricAggregates({ serviceId: nextServiceId, environment, from: fromIso, limit: 100 })
    ])
      .then(([logRows, aggregateRows]) => {
        setLogs(logRows);
        setAggregates(aggregateRows);
      })
      .catch((error) => setStatus(error instanceof Error ? error.message : "Failed to load telemetry context"));
  }, [incidentId, serviceId, environment, fromIso]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selectedIncident) {
      setStatus("Select an incident before running RCA.");
      return;
    }
    setLoading(true);
    setStatus("Analyzing incident");
    try {
      const serviceName = selectedService?.name ?? "unmapped-service";
      const relevantLogs = logs.slice(0, 25);
      const [summary, analysis] = await Promise.all([
        summarizeLogs({ serviceName, logs: relevantLogs }),
        analyzeIncident({
          incidentId: selectedIncident.id,
          incidentTitle: selectedIncident.title,
          serviceId: selectedIncident.serviceId ?? selectedService?.id,
          serviceName,
          environment,
          severity: selectedIncident.severity,
          status: selectedIncident.status,
          summary: selectedIncident.summary,
          operatorNotes,
          logs: relevantLogs,
          metricsSummary,
          deployment: selectedDeployment
        })
      ]);
      setResult({ summary, analysis });
      setStatus("Analysis complete");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "AI analysis failed");
    } finally {
      setLoading(false);
    }
  }

  async function persistAnalysis() {
    if (!selectedIncident || !result?.analysis || typeof result.analysis !== "object") return;
    setLoading(true);
    setStatus("Saving analysis to incident");
    try {
      await saveIncidentAnalysis(selectedIncident.id, result.analysis as Record<string, unknown>);
      setStatus("Analysis saved to incident");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save analysis");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">AI RCA</h2>
          <p className="mt-1 text-sm text-text-soft">Run root-cause analysis against selected incident telemetry and recent deployments.</p>
        </div>
        <Button icon={<RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />} disabled={loading} onClick={load}>
          Refresh Context
        </Button>
      </div>

      {status ? <div className="aegis-glass rounded-2xl p-3 text-sm text-text-soft">{status}</div> : null}

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Incidents" value={incidents.length} detail="available for RCA" />
        <StatCard label="Logs" value={logs.length} detail={`since ${new Date(fromIso).toLocaleString()}`} />
        <StatCard label="Metric samples" value={metricsSummary.samples} detail={`p95 ${Math.round(metricsSummary.p95LatencyMs)}ms`} />
        <StatCard label="Deployments" value={deployments.length} detail={`environment: ${environment}`} />
      </div>

      <form onSubmit={submit} className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <Card
          title="Analysis Context"
          description="Select real incident and service data from the platform."
          action={<BrainCircuit className="h-5 w-5 text-amber" />}
        >
          <div className="grid gap-3">
            <Select value={incidentId} onChange={(event) => setIncidentId(event.target.value)} aria-label="Incident">
              <option value="">Select incident</option>
              {incidents.map((incident) => (
                <option key={incident.id} value={incident.id}>
                  {incident.title}
                </option>
              ))}
            </Select>
            <Select value={serviceId} onChange={(event) => setServiceId(event.target.value)} aria-label="Service">
              <option value="">Select service</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </Select>
            <Textarea
              value={operatorNotes}
              onChange={(event) => setOperatorNotes(event.target.value)}
              placeholder="Optional operator notes from the current investigation"
              aria-label="Operator notes"
            />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="primary" disabled={loading || !incidentId} icon={<Sparkles className="h-4 w-4" />}>
                Analyze
              </Button>
              <Button type="button" disabled={loading || !result?.analysis} icon={<Save className="h-4 w-4" />} onClick={persistAnalysis}>
                Save
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid gap-5">
          <Card title="Selected Incident" description="Live incident metadata used in the RCA request.">
            {selectedIncident ? (
              <div className="grid gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-white">{selectedIncident.title}</h3>
                  <SeverityBadge severity={selectedIncident.severity} />
                  <StatusBadge status={selectedIncident.status} />
                </div>
                <p className="text-sm text-text-soft">{selectedIncident.summary ?? "No incident summary recorded."}</p>
                <p className="text-xs text-text-muted">Created {new Date(selectedIncident.createdAt).toLocaleString()}</p>
              </div>
            ) : (
              <p className="text-sm text-text-muted">No incident selected.</p>
            )}
          </Card>

          <Card title="Analysis Result" description="Returned by the AI RCA service.">
            {result ? (
              <pre className="max-h-[460px] overflow-auto aegis-glass rounded-2xl p-4 text-xs leading-5 text-text-soft">
                {JSON.stringify(result, null, 2)}
              </pre>
            ) : (
              <p className="text-sm text-text-muted">Run analysis to populate this panel.</p>
            )}
          </Card>
        </div>
      </form>
    </div>
  );
}
