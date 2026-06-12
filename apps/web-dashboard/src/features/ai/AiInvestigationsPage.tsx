import { Bot, FileText, RefreshCw, Save, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  analyzeIncident,
  fetchIncidentAnalysis,
  fetchIncidentEvidence,
  fetchIncidents,
  fetchLogs,
  fetchMetricAggregates,
  fetchServices,
  generateIncidentPostmortem,
  saveIncidentAnalysis,
  type IncidentAnalysisRecord,
  type IncidentEvidenceRecord,
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

export function AiInvestigationsPage() {
  const { environment, fromIso } = useWorkspace();
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [incidentId, setIncidentId] = useState("");
  const [logs, setLogs] = useState<any[]>([]);
  const [aggregates, setAggregates] = useState<MetricAggregateRecord[]>([]);
  const [analysis, setAnalysis] = useState<IncidentAnalysisRecord[]>([]);
  const [evidence, setEvidence] = useState<IncidentEvidenceRecord[]>([]);
  const [notes, setNotes] = useState("");
  const [latestResult, setLatestResult] = useState<Record<string, unknown>>();
  const [postmortem, setPostmortem] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedIncident = incidents.find((incident) => incident.id === incidentId);
  const selectedService = services.find((service) => service.id === selectedIncident?.serviceId);
  const metricsSummary = useMemo(
    () => ({
      p95LatencyMs: Math.max(0, ...aggregates.map((item) => numberValue(item.p95))),
      p99LatencyMs: Math.max(0, ...aggregates.map((item) => numberValue(item.p99))),
      samples: aggregates.reduce((sum, item) => sum + numberValue(item.count), 0)
    }),
    [aggregates]
  );

  async function load() {
    setLoading(true);
    setStatus("");
    try {
      const [incidentRows, serviceRows] = await Promise.all([fetchIncidents(), fetchServices()]);
      setIncidents(incidentRows);
      setServices(serviceRows);
      const nextIncidentId =
        incidentId || incidentRows.find((incident) => !["resolved", "closed"].includes(incident.status))?.id || incidentRows[0]?.id || "";
      setIncidentId(nextIncidentId);
      if (nextIncidentId) await loadIncidentContext(nextIncidentId, incidentRows, serviceRows);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load investigations");
    } finally {
      setLoading(false);
    }
  }

  async function loadIncidentContext(nextIncidentId: string, incidentRows = incidents, serviceRows = services) {
    const incident = incidentRows.find((item) => item.id === nextIncidentId);
    const service = serviceRows.find((item) => item.id === incident?.serviceId);
    const [analysisData, evidenceRows, logRows, aggregateRows] = await Promise.all([
      fetchIncidentAnalysis(nextIncidentId),
      fetchIncidentEvidence(nextIncidentId),
      fetchLogs({ serviceId: service?.id, environment, from: fromIso, limit: 75 }),
      fetchMetricAggregates({ serviceId: service?.id, environment, from: fromIso, limit: 150 })
    ]);
    setAnalysis(analysisData.analysis);
    setEvidence(evidenceRows);
    setLogs(logRows);
    setAggregates(aggregateRows);
  }

  useEffect(() => {
    load();
  }, [environment, fromIso]);

  useEffect(() => {
    if (!incidentId) return;
    loadIncidentContext(incidentId).catch((error) => setStatus(error instanceof Error ? error.message : "Failed to load incident context"));
  }, [incidentId]);

  async function runInvestigation() {
    if (!selectedIncident) {
      setStatus("Select an incident before starting investigation.");
      return;
    }
    setLoading(true);
    setStatus("Running investigation");
    try {
      const result = await analyzeIncident({
        incidentId: selectedIncident.id,
        incidentTitle: selectedIncident.title,
        serviceId: selectedIncident.serviceId,
        serviceName: selectedService?.name,
        environment,
        severity: selectedIncident.severity,
        status: selectedIncident.status,
        notes,
        logs: logs.slice(0, 40),
        metricsSummary,
        evidence: evidence.map((item) => ({ type: item.evidenceType, title: item.title, payload: item.payload }))
      });
      setLatestResult(result);
      setStatus("Investigation complete");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Investigation failed");
    } finally {
      setLoading(false);
    }
  }

  async function saveLatest() {
    if (!selectedIncident || !latestResult) return;
    setLoading(true);
    setStatus("Saving investigation");
    try {
      await saveIncidentAnalysis(selectedIncident.id, latestResult);
      const analysisData = await fetchIncidentAnalysis(selectedIncident.id);
      setAnalysis(analysisData.analysis);
      setStatus("Investigation saved");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save investigation");
    } finally {
      setLoading(false);
    }
  }

  async function generatePostmortem() {
    if (!selectedIncident) return;
    setLoading(true);
    setStatus("Generating postmortem");
    try {
      const response = await generateIncidentPostmortem(selectedIncident.id);
      setPostmortem(response.postmortemDraft);
      const analysisData = await fetchIncidentAnalysis(selectedIncident.id);
      setAnalysis(analysisData.analysis);
      setStatus("Postmortem generated");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Postmortem generation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">AI Investigations</h2>
          <p className="mt-1 text-sm text-text-soft">
            Incident investigation workspace backed by RCA analysis, evidence, logs, and postmortems.
          </p>
        </div>
        <Button icon={<RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />} disabled={loading} onClick={load}>
          Refresh
        </Button>
      </div>

      {status ? <div className="aegis-glass rounded-2xl p-3 text-sm text-text-soft">{status}</div> : null}

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Incidents" value={incidents.length} detail="available cases" />
        <StatCard label="Evidence" value={evidence.length} detail="linked records" />
        <StatCard label="Saved RCA" value={analysis.length} detail="incident analyses" />
        <StatCard label="Telemetry" value={logs.length + metricsSummary.samples} detail="logs plus metric samples" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <Card
          title="Investigation Controls"
          description="Choose a real incident and run the AI RCA service with current evidence."
          action={<Bot className="h-5 w-5 text-white" />}
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
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Investigation notes, hypotheses, or operator observations"
              aria-label="Investigation notes"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                disabled={loading || !incidentId}
                icon={<Sparkles className="h-4 w-4" />}
                onClick={runInvestigation}
              >
                Investigate
              </Button>
              <Button disabled={loading || !latestResult} icon={<Save className="h-4 w-4" />} onClick={saveLatest}>
                Save
              </Button>
              <Button disabled={loading || !incidentId} icon={<FileText className="h-4 w-4" />} onClick={generatePostmortem}>
                Postmortem
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid gap-5">
          <Card title="Selected Incident" description="Incident metadata and service mapping.">
            {selectedIncident ? (
              <div className="grid gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-white">{selectedIncident.title}</h3>
                  <SeverityBadge severity={selectedIncident.severity} />
                  <StatusBadge status={selectedIncident.status} />
                </div>
                <p className="text-sm text-text-soft">{selectedIncident.summary ?? "No incident summary recorded."}</p>
                <p className="text-xs text-text-muted">
                  {selectedService?.name ?? "Unmapped service"} / {new Date(selectedIncident.createdAt).toLocaleString()}
                </p>
              </div>
            ) : (
              <p className="text-sm text-text-muted">Select an incident to inspect.</p>
            )}
          </Card>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card title="Saved Analyses" description="Persisted AI RCA records for this incident.">
              <div className="grid gap-3">
                {analysis.map((item) => (
                  <div key={item.id} className="aegis-glass rounded-2xl p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">{item.likelyRootCause}</p>
                      <span className="text-xs text-text-muted">{Math.round(item.confidenceScore * 100)}%</span>
                    </div>
                    <p className="mt-2 text-sm text-text-soft">{item.summary}</p>
                  </div>
                ))}
                {analysis.length === 0 ? <p className="text-sm text-text-muted">No saved analyses for this incident.</p> : null}
              </div>
            </Card>

            <Card title="Evidence" description="Incident evidence from the core API.">
              <div className="grid gap-3">
                {evidence.map((item) => (
                  <div key={item.id} className="aegis-glass rounded-2xl p-3">
                    <p className="text-sm font-semibold text-white">{item.title ?? item.evidenceType}</p>
                    <p className="mt-1 text-xs text-text-muted">
                      {item.evidenceType} / {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
                {evidence.length === 0 ? <p className="text-sm text-text-muted">No evidence attached yet.</p> : null}
              </div>
            </Card>
          </div>

          <Card title="Latest Result" description="Most recent unsaved investigation response and postmortem draft.">
            <div className="grid gap-3 xl:grid-cols-2">
              <pre className="max-h-[420px] overflow-auto aegis-glass rounded-2xl p-4 text-xs leading-5 text-text-soft">
                {latestResult ? JSON.stringify(latestResult, null, 2) : "Run an investigation to populate this result."}
              </pre>
              <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap aegis-glass rounded-2xl p-4 text-xs leading-5 text-text-soft">
                {postmortem || "Generate a postmortem to populate this draft."}
              </pre>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
