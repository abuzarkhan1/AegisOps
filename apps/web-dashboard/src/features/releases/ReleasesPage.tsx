import { GitCommit, RefreshCw, Rocket, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  fetchDeploymentImpact,
  fetchDeployments,
  fetchIncidents,
  fetchServices,
  type DeploymentRecord,
  type IncidentRecord,
  type ServiceRecord
} from "../../shared/api/core";
import { useWorkspace } from "../../app/workspace";
import { StatusBadge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { Card, StatCard } from "../../shared/ui/Card";

const formatDate = (value?: string) => (value ? new Date(value).toLocaleString() : "No timestamp");

export function ReleasesPage() {
  const { environment } = useWorkspace();
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [selectedDeploymentId, setSelectedDeploymentId] = useState("");
  const [impact, setImpact] = useState<Record<string, unknown>>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [deploymentRows, serviceRows, incidentRows] = await Promise.all([fetchDeployments(), fetchServices(), fetchIncidents()]);
      const envDeployments = deploymentRows.filter((deployment) => deployment.environment === environment);
      setDeployments(envDeployments);
      setServices(serviceRows.filter((service) => service.environment === environment));
      setIncidents(incidentRows);
      const nextDeploymentId = selectedDeploymentId || envDeployments[0]?.id || "";
      setSelectedDeploymentId(nextDeploymentId);
      if (nextDeploymentId) setImpact(await fetchDeploymentImpact(nextDeploymentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load releases");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [environment]);

  useEffect(() => {
    if (!selectedDeploymentId) {
      setImpact(undefined);
      return;
    }
    fetchDeploymentImpact(selectedDeploymentId)
      .then(setImpact)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load deployment impact"));
  }, [selectedDeploymentId]);

  const selectedDeployment = deployments.find((deployment) => deployment.id === selectedDeploymentId);
  const latestByService = useMemo(() => {
    const map = new Map<string, DeploymentRecord>();
    for (const deployment of deployments) {
      const current = map.get(deployment.serviceName);
      const currentTime = new Date(current?.createdAt ?? 0).getTime();
      const nextTime = new Date(deployment.createdAt).getTime();
      if (!current || nextTime > currentTime) map.set(deployment.serviceName, deployment);
    }
    return Array.from(map.values());
  }, [deployments]);
  const activeIncidents = incidents.filter((incident) => !["resolved", "closed"].includes(incident.status));
  const releaseIncidents = activeIncidents.filter((incident) => {
    const service = services.find((item) => item.id === incident.serviceId);
    return service && latestByService.some((deployment) => deployment.serviceName === service.name);
  });

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Releases</h2>
          <p className="mt-1 text-sm text-text-soft">Deployment stream, latest service versions, and impact analysis.</p>
        </div>
        <Button icon={<RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />} disabled={loading} onClick={load}>
          Refresh
        </Button>
      </div>
      {error ? <div className="rounded-2xl border border-rose/40 bg-rose/10 p-3 text-sm text-rose">{error}</div> : null}

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Deployments" value={deployments.length} detail={`environment: ${environment}`} />
        <StatCard label="Released services" value={latestByService.length} detail="latest version tracked" />
        <StatCard label="Active incidents" value={releaseIncidents.length} detail="on released services" />
        <StatCard
          label="Latest version"
          value={selectedDeployment?.version ?? selectedDeployment?.commitSha?.slice(0, 7) ?? "-"}
          detail={selectedDeployment?.serviceName ?? "none selected"}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <Card title="Deployment Stream" description="Events from the deployment tracker service.">
          <div className="grid gap-2">
            {deployments.map((deployment) => (
              <button
                key={deployment.id}
                type="button"
                onClick={() => setSelectedDeploymentId(deployment.id)}
                className={`rounded-2xl border p-3 text-left transition ${selectedDeploymentId === deployment.id ? "border-white/40 bg-white/10" : "border-white/10 bg-white/5 hover:border-slate-500"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-white">{deployment.serviceName}</p>
                  <StatusBadge status={deployment.status ?? "received"} />
                </div>
                <p className="mt-1 text-xs text-text-soft">{deployment.version ?? deployment.commitSha ?? "unversioned"}</p>
                <p className="mt-1 text-xs text-text-muted">{formatDate(deployment.createdAt)}</p>
              </button>
            ))}
            {deployments.length === 0 ? (
              <p className="text-sm text-text-muted">No deployments found for the selected environment.</p>
            ) : null}
          </div>
        </Card>

        <div className="grid gap-5">
          <Card title="Selected Release" description="Deployment details and impact metadata.">
            {selectedDeployment ? (
              <div className="grid gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Rocket className="h-5 w-5 text-white" />
                  <h3 className="text-base font-semibold text-white">{selectedDeployment.serviceName}</h3>
                  <StatusBadge status={selectedDeployment.status ?? "received"} />
                </div>
                <div className="grid gap-3 text-sm text-text-soft md:grid-cols-3">
                  <ReleaseField label="Version" value={selectedDeployment.version ?? "-"} />
                  <ReleaseField label="Commit" value={selectedDeployment.commitSha ?? "-"} />
                  <ReleaseField label="Branch" value={selectedDeployment.branch ?? "-"} />
                  <ReleaseField label="Provider" value={selectedDeployment.provider} />
                  <ReleaseField label="Actor" value={selectedDeployment.deployedBy ?? "-"} />
                  <ReleaseField label="Repository" value={selectedDeployment.repository ?? "-"} />
                </div>
                <pre className="max-h-72 overflow-auto aegis-glass rounded-2xl p-4 text-xs leading-5 text-text-soft">
                  {JSON.stringify(impact ?? { status: "pending", message: "No impact analysis returned yet." }, null, 2)}
                </pre>
              </div>
            ) : (
              <p className="text-sm text-text-muted">Select a deployment to inspect release details.</p>
            )}
          </Card>

          <Card title="Service Release State" description="Latest deployment per service.">
            <div className="grid gap-3 xl:grid-cols-2">
              {latestByService.map((deployment) => (
                <div key={`${deployment.serviceName}-${deployment.id}`} className="aegis-glass rounded-2xl p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <GitCommit className="h-4 w-4 text-amber" />
                        <p className="truncate text-sm font-semibold text-white">{deployment.serviceName}</p>
                      </div>
                      <p className="mt-1 text-xs text-text-muted">{formatDate(deployment.createdAt)}</p>
                    </div>
                    <StatusBadge status={deployment.status ?? "received"} />
                  </div>
                  <p className="mt-3 truncate font-mono text-xs text-text-soft">
                    {deployment.version ?? deployment.commitSha ?? "unversioned"}
                  </p>
                </div>
              ))}
              {latestByService.length === 0 ? <p className="text-sm text-text-muted">No service release state is available yet.</p> : null}
            </div>
          </Card>

          <Card title="Release Risk" description="Open incidents on services with current release records.">
            <div className="grid gap-2">
              {releaseIncidents.map((incident) => (
                <div key={incident.id} className="flex items-center justify-between gap-3 aegis-glass rounded-2xl p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{incident.title}</p>
                    <p className="mt-1 text-xs text-text-muted">{incident.status}</p>
                  </div>
                  <ShieldAlert className="h-4 w-4 text-rose" />
                </div>
              ))}
              {releaseIncidents.length === 0 ? (
                <p className="text-sm text-text-muted">No open incidents are associated with current releases.</p>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ReleaseField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase text-text-muted/70">{label}</p>
      <p className="mt-1 break-all font-mono text-xs text-text-primary">{value}</p>
    </div>
  );
}
