import {
  Activity,
  AlertTriangle,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Siren
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  acknowledgeIncident,
  addIncidentEvidence,
  analyzeIncident,
  closeIncident,
  fetchIncidentAnalysis,
  fetchIncidentEvidence,
  fetchIncidents,
  fetchIncidentTimeline,
  generateIncidentPostmortem,
  identifyIncident,
  monitorIncident,
  reopenIncident,
  resolveIncident,
  saveIncidentAnalysis
} from "../../shared/api/core";
import type { IncidentAnalysisRecord, IncidentEvidenceRecord, IncidentRecord } from "../../shared/api/core";
import { EmptyState } from "../../shared/ui/EmptyState";

const severityClass: Record<string, string> = {
  critical: "border-rose-500/40 bg-rose-500/10 text-rose-400",
  high: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  medium: "border-mint/40 bg-mint/10 text-mint",
  low: "border-mint/40 bg-mint/10 text-mint"
};

const statusColors: Record<string, string> = {
  open: "text-rose-400",
  investigating: "text-amber-400",
  identified: "text-mint",
  monitoring: "text-indigo-400",
  resolved: "text-mint",
  closed: "text-slate-400"
};

const evidenceTabs = ["all", "log", "metric", "deployment", "route", "related_incident"];
const evidenceTypeOptions = ["log", "metric", "deployment", "route", "related_incident", "note"];

const asTextList = (value: unknown) => (Array.isArray(value) ? value.map((item) => String(item)) : []);

const formatDate = (value?: string) => (value ? new Date(value).toLocaleString() : "Pending");

const formatDuration = (incident: IncidentRecord) => {
  const start = new Date(incident.createdAt).getTime();
  const end = incident.resolvedAt ? new Date(incident.resolvedAt).getTime() : Date.now();
  const minutes = Math.max(0, Math.round((end - start) / 60000));
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

const labelFor = (value: string) => value.replace(/_/g, " ");

const jsonPreview = (value: Record<string, unknown>) => {
  const text = JSON.stringify(value ?? {}, null, 2);
  return text.length > 500 ? `${text.slice(0, 500)}...` : text;
};

export function IncidentsPage() {
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<IncidentRecord | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [evidence, setEvidence] = useState<IncidentEvidenceRecord[]>([]);
  const [analysis, setAnalysis] = useState<IncidentAnalysisRecord | null>(null);
  const [evidenceTab, setEvidenceTab] = useState("all");
  const [evidenceForm, setEvidenceForm] = useState({ evidenceType: "log", title: "", payload: "{\n  \n}" });
  const [error, setError] = useState<string>();
  const [statusMessage, setStatusMessage] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [loadingIncidentDetails, setLoadingIncidentDetails] = useState(false);
  const [actionLoading, setActionLoading] = useState<string>();

  const filteredEvidence = useMemo(
    () => (evidenceTab === "all" ? evidence : evidence.filter((item) => item.evidenceType === evidenceTab)),
    [evidence, evidenceTab]
  );

  const loadIncidents = async (preferredIncidentId?: string) => {
    setLoading(true);
    try {
      const data = await fetchIncidents();
      setIncidents(data);
      const targetId = preferredIncidentId ?? selectedIncident?.id;
      const nextSelected = targetId ? data.find((incident) => incident.id === targetId) : data[0];
      setSelectedIncident(nextSelected ?? null);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load incidents");
    } finally {
      setLoading(false);
    }
  };

  const loadIncidentDetails = async (incidentId: string) => {
    setLoadingIncidentDetails(true);
    try {
      const [tlData, aiData, evidenceData] = await Promise.all([
        fetchIncidentTimeline(incidentId),
        fetchIncidentAnalysis(incidentId),
        fetchIncidentEvidence(incidentId)
      ]);
      setTimeline(tlData);
      setEvidence(evidenceData);
      setAnalysis(aiData.analysis && aiData.analysis.length > 0 ? aiData.analysis[0] : null);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Failed to load incident details");
    } finally {
      setLoadingIncidentDetails(false);
    }
  };

  useEffect(() => {
    loadIncidents();
  }, []);

  useEffect(() => {
    if (selectedIncident) {
      loadIncidentDetails(selectedIncident.id);
    } else {
      setTimeline([]);
      setEvidence([]);
      setAnalysis(null);
    }
  }, [selectedIncident?.id]);

  const refreshSelected = async (incident: IncidentRecord, message?: string) => {
    setSelectedIncident(incident);
    setStatusMessage(message);
    await loadIncidents(incident.id);
    await loadIncidentDetails(incident.id);
  };

  const runAction = async (label: string, action: () => Promise<{ incident: IncidentRecord }>, success: string) => {
    if (!selectedIncident) return;
    setActionLoading(label);
    try {
      const result = await action();
      await refreshSelected(result.incident, success);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Incident action failed");
    } finally {
      setActionLoading(undefined);
    }
  };

  const handleAddEvidence = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedIncident) return;
    setActionLoading("evidence");
    try {
      const trimmed = evidenceForm.payload.trim();
      const payload = trimmed ? JSON.parse(trimmed) : {};
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new Error("Evidence payload must be a JSON object");
      }
      await addIncidentEvidence(selectedIncident.id, {
        evidenceType: evidenceForm.evidenceType,
        title: evidenceForm.title || labelFor(evidenceForm.evidenceType),
        payload
      });
      setEvidenceForm({ evidenceType: evidenceForm.evidenceType, title: "", payload: "{\n  \n}" });
      setEvidenceTab(evidenceForm.evidenceType);
      setStatusMessage("Evidence added");
      await loadIncidentDetails(selectedIncident.id);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Failed to add evidence");
    } finally {
      setActionLoading(undefined);
    }
  };

  const handleRunRca = async () => {
    if (!selectedIncident) return;
    setActionLoading("rca");
    try {
      const result = await analyzeIncident({
        incidentId: selectedIncident.id,
        organizationId: selectedIncident.organizationId,
        projectId: selectedIncident.projectId,
        serviceId: selectedIncident.serviceId,
        severity: selectedIncident.severity,
        summary: selectedIncident.summary ?? selectedIncident.title,
        logs: evidence.filter((item) => item.evidenceType === "log").map((item) => item.payload),
        metricsSummary: evidence.find((item) => item.evidenceType === "metric")?.payload ?? {},
        evidence: evidence.map((item) => ({ type: item.evidenceType, title: item.title, payload: item.payload }))
      });
      await saveIncidentAnalysis(selectedIncident.id, {
        summary: String(result.summary ?? "AI analysis completed."),
        likelyRootCause: String(result.likelyRootCause ?? "Pending final engineer review."),
        confidenceScore: typeof result.confidenceScore === "number" ? result.confidenceScore : 0.5,
        evidence: asTextList(result.evidence),
        recommendedActions: asTextList(result.recommendedActions),
        rollbackRecommendation: typeof result.rollbackRecommendation === "string" ? result.rollbackRecommendation : undefined,
        postmortemDraft: typeof result.postmortemDraft === "string" ? result.postmortemDraft : undefined
      });
      setStatusMessage("AI RCA saved");
      await loadIncidentDetails(selectedIncident.id);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Failed to run AI RCA");
    } finally {
      setActionLoading(undefined);
    }
  };

  const handleGeneratePostmortem = async () => {
    if (!selectedIncident) return;
    setActionLoading("postmortem");
    try {
      const result = await generateIncidentPostmortem(selectedIncident.id);
      setAnalysis(result.analysis);
      setStatusMessage("Postmortem draft generated");
      await loadIncidentDetails(selectedIncident.id);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Failed to generate postmortem");
    } finally {
      setActionLoading(undefined);
    }
  };

  const evidenceItems = asTextList(analysis?.evidence);
  const recommendedActions = asTextList(analysis?.recommendedActions);

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <div className="flex h-[780px] flex-col rounded-lg border border-line bg-panel p-5 shadow-panel">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Incidents</h2>
            <p className="text-xs text-slate-400">Lifecycle, evidence, RCA, and postmortems</p>
          </div>
          <button
            type="button"
            title="Refresh incidents"
            onClick={() => loadIncidents()}
            disabled={loading}
            className="grid h-9 w-9 place-items-center rounded-md border border-line bg-panel-soft text-slate-400 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {error ? <p className="mb-2 text-sm text-rose-400">{error}</p> : null}

        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {incidents.map((incident) => {
            const active = selectedIncident?.id === incident.id;
            return (
              <button
                key={incident.id}
                type="button"
                onClick={() => setSelectedIncident(incident)}
                className={`w-full rounded-lg border p-4 text-left transition ${
                  active ? "border-mint/50 bg-mint/10" : "border-line bg-panel-soft hover:border-line hover:bg-panel-hover"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-white">{incident.title}</p>
                  <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${severityClass[incident.severity] ?? severityClass.medium}`}>
                    {incident.severity}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-400">
                  <span className={`font-semibold capitalize ${statusColors[incident.status] ?? "text-slate-300"}`}>{labelFor(incident.status)}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(incident.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              </button>
            );
          })}
          {incidents.length === 0 && !loading ? <EmptyState title="No active incidents" /> : null}
        </div>
      </div>

      <div className="flex h-[780px] flex-col overflow-y-auto rounded-lg border border-line bg-panel p-6 shadow-panel">
        {selectedIncident ? (
          <div className="space-y-6 text-left">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-bold text-white">{selectedIncident.title}</h2>
                  <span className={`rounded-md border px-2.5 py-0.5 text-xs font-bold uppercase ${severityClass[selectedIncident.severity] ?? severityClass.medium}`}>
                    {selectedIncident.severity}
                  </span>
                  <span className={`rounded-md border border-line bg-panel-soft px-2.5 py-0.5 text-xs font-semibold capitalize ${statusColors[selectedIncident.status] ?? "text-slate-300"}`}>
                    {labelFor(selectedIncident.status)}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm text-slate-400 font-mono">Incident ID: {selectedIncident.id}</p>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                {selectedIncident.status === "open" ? (
                  <button
                    type="button"
                    onClick={() => runAction("acknowledge", () => acknowledgeIncident(selectedIncident.id), "Incident acknowledged")}
                    disabled={Boolean(actionLoading)}
                    className="inline-flex h-9 items-center gap-2 rounded-md bg-amber px-3 text-xs font-bold text-slate-950 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {actionLoading === "acknowledge" ? "Working..." : "Acknowledge"}
                  </button>
                ) : null}
                {["open", "investigating"].includes(selectedIncident.status) ? (
                  <button
                    type="button"
                    onClick={() => runAction("identify", () => identifyIncident(selectedIncident.id), "Root cause marked identified")}
                    disabled={Boolean(actionLoading)}
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-panel-soft px-3 text-xs font-semibold text-slate-200 disabled:opacity-50"
                  >
                    <ClipboardList className="h-4 w-4" />
                    Identify
                  </button>
                ) : null}
                {selectedIncident.status === "identified" ? (
                  <button
                    type="button"
                    onClick={() => runAction("monitor", () => monitorIncident(selectedIncident.id), "Incident moved to monitoring")}
                    disabled={Boolean(actionLoading)}
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-panel-soft px-3 text-xs font-semibold text-slate-200 disabled:opacity-50"
                  >
                    <Activity className="h-4 w-4" />
                    Monitor
                  </button>
                ) : null}
                {!["resolved", "closed"].includes(selectedIncident.status) ? (
                  <button
                    type="button"
                    onClick={() => runAction("resolve", () => resolveIncident(selectedIncident.id), "Incident resolved")}
                    disabled={Boolean(actionLoading)}
                    className="inline-flex h-9 items-center gap-2 rounded-md bg-mint px-3 text-xs font-bold text-slate-950 disabled:opacity-50"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Resolve
                  </button>
                ) : null}
                {["resolved", "closed"].includes(selectedIncident.status) ? (
                  <button
                    type="button"
                    onClick={() => runAction("reopen", () => reopenIncident(selectedIncident.id), "Incident reopened")}
                    disabled={Boolean(actionLoading)}
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-panel-soft px-3 text-xs font-semibold text-slate-200 disabled:opacity-50"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reopen
                  </button>
                ) : null}
                {selectedIncident.status === "resolved" ? (
                  <button
                    type="button"
                    onClick={() => runAction("close", () => closeIncident(selectedIncident.id), "Incident closed")}
                    disabled={Boolean(actionLoading)}
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-panel-soft px-3 text-xs font-semibold text-slate-200 disabled:opacity-50"
                  >
                    <Lock className="h-4 w-4" />
                    Close
                  </button>
                ) : null}
              </div>
            </div>

            {statusMessage ? <div className="rounded-md border border-line bg-panel-soft px-3 py-2 text-sm text-slate-300">{statusMessage}</div> : null}

            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-line bg-panel-soft p-4">
                <span className="text-xs uppercase text-slate-400">Duration</span>
                <p className="mt-1 text-xl font-bold text-white">{formatDuration(selectedIncident)}</p>
              </div>
              <div className="rounded-lg border border-line bg-panel-soft p-4">
                <span className="text-xs uppercase text-slate-400">Evidence</span>
                <p className="mt-1 text-xl font-bold text-white">{evidence.length}</p>
              </div>
              <div className="rounded-lg border border-line bg-panel-soft p-4">
                <span className="text-xs uppercase text-slate-400">Timeline</span>
                <p className="mt-1 text-xl font-bold text-white">{timeline.length}</p>
              </div>
              <div className="rounded-lg border border-line bg-panel-soft p-4">
                <span className="text-xs uppercase text-slate-400">AI Confidence</span>
                <p className="mt-1 text-xl font-bold text-white">{analysis ? `${Math.round(Number(analysis.confidenceScore ?? 0) * 100)}%` : "Pending"}</p>
              </div>
            </div>

            <section>
              <h3 className="mb-2 text-sm font-bold uppercase text-slate-400">Description / Summary</h3>
              <div className="rounded-lg border border-line bg-panel-soft p-4 text-sm leading-relaxed text-slate-300">
                {selectedIncident.summary || "No description provided."}
              </div>
            </section>

            <section className="rounded-lg border border-amber-500/20 bg-amber/10 p-5 shadow-panel">
              <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-amber-500/10 pb-3">
                <ShieldCheck className="h-5 w-5 text-amber-400" />
                <h3 className="text-base font-bold text-amber-400">AI Root Cause Analysis</h3>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRunRca}
                    disabled={Boolean(actionLoading)}
                    className="inline-flex h-8 items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 text-xs font-semibold text-amber-200 disabled:opacity-50"
                  >
                    <BrainCircuit className="h-4 w-4" />
                    {actionLoading === "rca" ? "Running..." : "Run RCA"}
                  </button>
                  <button
                    type="button"
                    onClick={handleGeneratePostmortem}
                    disabled={Boolean(actionLoading)}
                    className="inline-flex h-8 items-center gap-2 rounded-md border border-line bg-panel-soft px-3 text-xs font-semibold text-slate-200 disabled:opacity-50"
                  >
                    <FileText className="h-4 w-4" />
                    {actionLoading === "postmortem" ? "Generating..." : "Postmortem"}
                  </button>
                </div>
              </div>

              {loadingIncidentDetails ? (
                <div className="py-6 text-center text-sm text-slate-400">Loading AI analysis...</div>
              ) : analysis ? (
                <div className="space-y-4 text-sm text-slate-300">
                  <div>
                    <h4 className="mb-1 text-xs font-bold uppercase text-slate-400">Executive Summary</h4>
                    <p className="leading-relaxed text-slate-200">{analysis.summary}</p>
                  </div>
                  <div>
                    <h4 className="mb-1 text-xs font-bold uppercase text-slate-400">Likely Root Cause</h4>
                    <p className="font-medium leading-relaxed text-amber-200/90">{analysis.likelyRootCause}</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <h4 className="mb-1.5 text-xs font-bold uppercase text-slate-400">Evidence Identified</h4>
                      <ul className="list-disc space-y-1 pl-4 text-xs text-slate-300">
                        {evidenceItems.map((item, idx) => (
                          <li key={`${item}-${idx}`}>{item}</li>
                        ))}
                        {evidenceItems.length === 0 ? <li>No AI evidence recorded.</li> : null}
                      </ul>
                    </div>
                    <div>
                      <h4 className="mb-1.5 text-xs font-bold uppercase text-slate-400">Recommended Actions</h4>
                      <ul className="list-disc space-y-1 pl-4 text-xs text-slate-300">
                        {recommendedActions.map((item, idx) => (
                          <li key={`${item}-${idx}`}>{item}</li>
                        ))}
                        {recommendedActions.length === 0 ? <li>No recommended actions recorded.</li> : null}
                      </ul>
                    </div>
                  </div>
                  {analysis.rollbackRecommendation ? (
                    <div className="flex items-start gap-2.5 rounded border border-rose-500/30 bg-rose-500/5 p-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                      <div>
                        <span className="block text-xs font-bold uppercase text-rose-400">Rollback Advice</span>
                        <p className="mt-0.5 text-xs">{analysis.rollbackRecommendation}</p>
                      </div>
                    </div>
                  ) : null}
                  {analysis.postmortemDraft ? (
                    <div>
                      <h4 className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase text-slate-400">
                        <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                        Postmortem Draft
                      </h4>
                      <div className="max-h-52 overflow-y-auto whitespace-pre-wrap rounded border border-line bg-panel-soft p-3 font-mono text-xs leading-5 text-slate-300">
                        {analysis.postmortemDraft}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="py-6 text-center text-sm text-slate-400">No AI RCA has been generated yet.</div>
              )}
            </section>

            <section className="grid gap-4 xl:grid-cols-[1fr_320px]">
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h3 className="mr-auto text-sm font-bold uppercase text-slate-400">Evidence</h3>
                  {evidenceTabs.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setEvidenceTab(tab)}
                      className={`h-8 rounded-md border px-3 text-xs capitalize ${
                        evidenceTab === tab ? "border-mint bg-mint/10 text-mint" : "border-line bg-panel-soft text-slate-300"
                      }`}
                    >
                      {labelFor(tab)}
                    </button>
                  ))}
                </div>
                <div className="space-y-3">
                  {filteredEvidence.map((item) => (
                    <div key={item.id} className="rounded-lg border border-line bg-panel-soft p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md border border-slate-600 bg-panel-hover px-2 py-0.5 text-[10px] font-bold uppercase text-slate-300">
                            {labelFor(item.evidenceType)}
                          </span>
                          <p className="text-sm font-semibold text-white">{item.title ?? "Untitled evidence"}</p>
                        </div>
                        <span className="text-xs text-slate-500">{formatDate(item.createdAt)}</span>
                      </div>
                      <pre className="mt-3 max-h-44 overflow-auto rounded-md border border-line bg-slate-950/60 p-3 text-xs leading-5 text-slate-300">
                        {jsonPreview(item.payload)}
                      </pre>
                    </div>
                  ))}
                  {filteredEvidence.length === 0 ? <EmptyState title="No evidence in this tab" /> : null}
                </div>
              </div>

              <form onSubmit={handleAddEvidence} className="rounded-lg border border-line bg-panel-soft p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Plus className="h-4 w-4 text-mint" />
                  <h3 className="text-sm font-semibold text-white">Add Evidence</h3>
                </div>
                <label className="mb-3 block text-xs font-semibold uppercase text-slate-400">
                  Type
                  <select
                    value={evidenceForm.evidenceType}
                    onChange={(event) => setEvidenceForm((current) => ({ ...current, evidenceType: event.target.value }))}
                    className="mt-1 h-10 w-full rounded-md border border-line bg-slate-950 px-3 text-sm normal-case text-white"
                  >
                    {evidenceTypeOptions.map((type) => (
                      <option key={type} value={type}>
                        {labelFor(type)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mb-3 block text-xs font-semibold uppercase text-slate-400">
                  Title
                  <input
                    value={evidenceForm.title}
                    onChange={(event) => setEvidenceForm((current) => ({ ...current, title: event.target.value }))}
                    className="mt-1 h-10 w-full rounded-md border border-line bg-slate-950 px-3 text-sm normal-case text-white"
                    placeholder="Database timeout log"
                  />
                </label>
                <label className="block text-xs font-semibold uppercase text-slate-400">
                  Payload JSON
                  <textarea
                    value={evidenceForm.payload}
                    onChange={(event) => setEvidenceForm((current) => ({ ...current, payload: event.target.value }))}
                    className="mt-1 h-40 w-full rounded-md border border-line bg-slate-950 p-3 font-mono text-xs normal-case leading-5 text-white"
                  />
                </label>
                <button
                  type="submit"
                  disabled={actionLoading === "evidence"}
                  className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-mint px-3 text-xs font-bold text-slate-950 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  {actionLoading === "evidence" ? "Adding..." : "Add Evidence"}
                </button>
              </form>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-bold uppercase text-slate-400">Incident Timeline</h3>
              {loadingIncidentDetails ? (
                <p className="text-xs text-slate-400">Loading timeline...</p>
              ) : (
                <div className="relative ml-2 space-y-4 border-l border-line pl-4">
                  {timeline.map((item, idx) => (
                    <div key={item.id || idx} className="relative">
                      <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-shell bg-slate-600" />
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold capitalize text-slate-300">{labelFor(String(item.eventType ?? "event"))}</span>
                          <span className="text-[10px] text-slate-500">{new Date(item.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-sm text-slate-300">{item.message}</p>
                      </div>
                    </div>
                  ))}
                  {timeline.length === 0 ? <p className="text-xs text-slate-500">No events on this timeline yet.</p> : null}
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="grid h-full place-items-center">
            <EmptyState title="Select an incident from the sidebar to view details" />
          </div>
        )}
      </div>
    </div>
  );
}
