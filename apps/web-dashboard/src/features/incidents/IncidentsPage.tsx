import { Siren, Clock, ShieldCheck, AlertCircle, User, RefreshCw, BarChart, ArrowRight, BookOpen, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchIncidents, fetchIncidentTimeline, fetchIncidentAnalysis, resolveIncident } from "../../shared/api/core";
import type { IncidentRecord } from "../../shared/api/core";
import { EmptyState } from "../../shared/ui/EmptyState";

const severityClass: Record<string, string> = {
  critical: "border-rose-500/40 bg-rose-500/10 text-rose-400",
  high: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  medium: "border-sky-400/40 bg-sky-400/10 text-sky-400",
  low: "border-mint/40 bg-mint/10 text-mint"
};

const statusColors: Record<string, string> = {
  open: "text-rose-400",
  investigating: "text-amber-400",
  identified: "text-sky-400",
  monitoring: "text-indigo-400",
  resolved: "text-mint"
};

export function IncidentsPage() {
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<IncidentRecord | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<any | null>(null);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [loadingIncidentDetails, setLoadingIncidentDetails] = useState(false);
  const [resolving, setResolving] = useState(false);

  const loadIncidents = async () => {
    setLoading(true);
    try {
      const data = await fetchIncidents();
      setIncidents(data);
      if (data.length > 0 && !selectedIncident) {
        setSelectedIncident(data[0]);
      } else if (selectedIncident) {
        const updated = data.find((i) => i.id === selectedIncident.id);
        if (updated) setSelectedIncident(updated);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load incidents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents();
  }, []);

  const loadIncidentDetails = async (incidentId: string) => {
    setLoadingIncidentDetails(true);
    try {
      const [tlData, aiData] = await Promise.all([
        fetchIncidentTimeline(incidentId),
        fetchIncidentAnalysis(incidentId)
      ]);
      setTimeline(tlData);
      setAnalysis(aiData.analysis && aiData.analysis.length > 0 ? aiData.analysis[0] : null);
    } catch (err) {
      console.error("Failed to load incident details", err);
    } finally {
      setLoadingIncidentDetails(false);
    }
  };

  useEffect(() => {
    if (selectedIncident) {
      loadIncidentDetails(selectedIncident.id);
    }
  }, [selectedIncident?.id]);

  const handleResolve = async () => {
    if (!selectedIncident) return;
    setResolving(true);
    try {
      await resolveIncident(selectedIncident.id);
      await loadIncidents();
    } catch (err) {
      alert("Failed to resolve incident: " + (err instanceof Error ? err.message : "unknown error"));
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      {/* Incidents Sidebar */}
      <div className="rounded-lg border border-line bg-panel p-5 shadow-panel flex flex-col h-[750px]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Incidents</h2>
            <p className="text-xs text-slate-400">Manage triggered events and RCAs</p>
          </div>
          <button
            onClick={loadIncidents}
            disabled={loading}
            className="p-2 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {error ? <p className="text-sm text-rose-400 mb-2">{error}</p> : null}

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {incidents.map((incident) => {
            const active = selectedIncident?.id === incident.id;
            return (
              <div
                key={incident.id}
                onClick={() => setSelectedIncident(incident)}
                className={`cursor-pointer rounded-lg border p-4 transition text-left ${
                  active
                    ? "border-mint/50 bg-[#0d2220]/60"
                    : "border-line bg-[#0d1419] hover:border-slate-700 hover:bg-slate-800/40"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-white">{incident.title}</p>
                  <span className={`rounded-md border px-2 py-0.5 text-[10px] uppercase font-bold shrink-0 ${severityClass[incident.severity] ?? severityClass.medium}`}>
                    {incident.severity}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-400">
                  <span className={`capitalize font-semibold ${statusColors[incident.status] ?? "text-slate-300"}`}>
                    {incident.status}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(incident.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            );
          })}
          {incidents.length === 0 && !loading ? (
            <EmptyState title="No active incidents" />
          ) : null}
        </div>
      </div>

      {/* Incident details Panel */}
      <div className="flex flex-col h-[750px] overflow-y-auto rounded-lg border border-line bg-panel p-6 shadow-panel">
        {selectedIncident ? (
          <div className="space-y-6 text-left">
            {/* Header info */}
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-white">{selectedIncident.title}</h2>
                  <span className={`rounded-md border px-2.5 py-0.5 text-xs uppercase font-bold ${severityClass[selectedIncident.severity] ?? severityClass.medium}`}>
                    {selectedIncident.severity}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-400 font-mono">Incident ID: {selectedIncident.id}</p>
              </div>

              <div className="flex items-center gap-3">
                <span className={`capitalize font-semibold text-sm rounded border border-line px-3 py-1.5 bg-[#0d1419] ${statusColors[selectedIncident.status] ?? "text-slate-300"}`}>
                  Status: {selectedIncident.status}
                </span>
                {selectedIncident.status !== "resolved" && (
                  <button
                    onClick={handleResolve}
                    disabled={resolving}
                    className="flex h-9 items-center justify-center rounded-md bg-mint px-4 text-xs font-bold text-slate-950 hover:bg-opacity-95 disabled:opacity-50 transition"
                  >
                    {resolving ? "Resolving..." : "Resolve Incident"}
                  </button>
                )}
              </div>
            </div>

            {/* Incident Summary */}
            <div>
              <h3 className="text-sm font-bold uppercase text-slate-400 mb-2">Description / Summary</h3>
              <div className="rounded-lg border border-line bg-[#0d1419] p-4 text-sm text-slate-300 leading-relaxed font-sans">
                {selectedIncident.summary || "No description provided."}
              </div>
            </div>

            {/* Metrics Trend Simulation placeholder */}
            <div>
              <h3 className="text-sm font-bold uppercase text-slate-400 mb-2">Metrics Snapshot during alert</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-line bg-[#0d1419] p-4 text-center">
                  <span className="text-xs text-slate-400 block mb-1">Triggering Error Rate</span>
                  <span className="text-2xl font-bold text-rose-400">{analysis ? "9.4%" : "Pending AI"}</span>
                </div>
                <div className="rounded-lg border border-line bg-[#0d1419] p-4 text-center">
                  <span className="text-xs text-slate-400 block mb-1">Tail Latency (P95)</span>
                  <span className="text-2xl font-bold text-amber-400">{analysis ? "1,450 ms" : "Pending AI"}</span>
                </div>
              </div>
            </div>

            {/* AI RCA Panel */}
            <div className="rounded-lg border border-amber-500/20 bg-gradient-to-r from-[#1c1c15] to-[#12120e] p-6 shadow-md">
              <div className="mb-4 flex items-center gap-2 border-b border-amber-500/10 pb-3">
                <ShieldCheck className="h-5 w-5 text-amber-400" />
                <h3 className="text-base font-bold text-amber-400">AI Root Cause Analysis Report</h3>
                {analysis && (
                  <span className="ml-auto rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">
                    Confidence: {Math.round(analysis.confidenceScore * 100)}%
                  </span>
                )}
              </div>

              {loadingIncidentDetails ? (
                <div className="py-6 text-center text-slate-400">Loading AI analysis...</div>
              ) : analysis ? (
                <div className="space-y-4 text-sm text-slate-300">
                  <div>
                    <h4 className="text-xs font-bold uppercase text-slate-400 mb-1">Executive Summary</h4>
                    <p className="leading-relaxed text-slate-200">{analysis.summary}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase text-slate-400 mb-1">Likely Root Cause</h4>
                    <p className="text-amber-200/90 font-medium leading-relaxed">{analysis.likelyRootCause}</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <h4 className="text-xs font-bold uppercase text-slate-400 mb-1.5">Evidence Identified</h4>
                      <ul className="space-y-1 list-disc pl-4 text-slate-300 text-xs">
                        {analysis.evidence.map((item: string, idx: number) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase text-slate-400 mb-1.5">Recommended Actions</h4>
                      <ul className="space-y-1 list-disc pl-4 text-slate-300 text-xs">
                        {analysis.recommendedActions.map((item: string, idx: number) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  {analysis.rollbackRecommendation && (
                    <div className="rounded border border-rose-500/30 bg-rose-500/5 p-3 flex items-start gap-2.5">
                      <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs font-bold text-rose-400 uppercase block">Rollback Advice</span>
                        <p className="text-xs mt-0.5">{analysis.rollbackRecommendation}</p>
                      </div>
                    </div>
                  )}
                  {analysis.postmortemDraft && (
                    <div>
                      <h4 className="text-xs font-bold uppercase text-slate-400 mb-1 flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                        Postmortem Draft
                      </h4>
                      <div className="rounded border border-line bg-[#0d1419] p-3 text-xs font-mono whitespace-pre-wrap max-h-40 overflow-y-auto leading-5 text-slate-300">
                        {analysis.postmortemDraft}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-6 text-center text-slate-400 text-sm">
                  No AI Analysis generated yet. Ensure worker service is running and consuming Kafka events.
                </div>
              )}
            </div>

            {/* Timeline Events */}
            <div>
              <h3 className="text-sm font-bold uppercase text-slate-400 mb-3">Incident Timeline</h3>
              {loadingIncidentDetails ? (
                <p className="text-xs text-slate-400">Loading timeline...</p>
              ) : (
                <div className="space-y-4 pl-4 border-l border-line relative ml-2">
                  {timeline.map((item, idx) => (
                    <div key={item.id || idx} className="relative">
                      <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-slate-600 border-2 border-shell" />
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold text-slate-300 capitalize">{item.eventType}</span>
                          <span className="text-[10px] text-slate-500">{new Date(item.createdAt).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-sm text-slate-300 font-sans">{item.message}</p>
                      </div>
                    </div>
                  ))}
                  {timeline.length === 0 && <p className="text-xs text-slate-500">No events on this timeline yet.</p>}
                </div>
              )}
            </div>
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
