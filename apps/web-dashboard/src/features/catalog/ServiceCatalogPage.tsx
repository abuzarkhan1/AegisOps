import { useEffect, useMemo, useState } from "react";
import { Activity, RefreshCw, Server, ShieldCheck } from "lucide-react";
import {
  fetchOrganizations,
  fetchProjects,
  fetchServiceConnectionStatus,
  fetchServices,
  type OrganizationRecord,
  type ProjectRecord,
  type ServiceConnectionStatus,
  type ServiceRecord
} from "../../shared/api/core";
import { useWorkspace } from "../../app/workspace";
import { StatusBadge, EnvironmentBadge, ServiceTypeBadge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { Card, StatCard } from "../../shared/ui/Card";

const compactId = (value?: string) => value ? `${value.slice(0, 8)}...${value.slice(-4)}` : "-";

export function ServiceCatalogPage() {
  const { environment } = useWorkspace();
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [connections, setConnections] = useState<Record<string, ServiceConnectionStatus>>({});
  const [query, setQuery] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [orgRows, projectRows, serviceRows] = await Promise.all([fetchOrganizations(), fetchProjects(), fetchServices()]);
      setOrganizations(orgRows);
      setProjects(projectRows);
      setServices(serviceRows);
      const statuses = await Promise.all(serviceRows.map(async (service) => [service.id, await fetchServiceConnectionStatus(service.id)] as const));
      setConnections(Object.fromEntries(statuses));
      if (!organizationId && orgRows[0]) setOrganizationId(orgRows[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load service catalog");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const projectsById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const organizationsById = useMemo(() => new Map(organizations.map((org) => [org.id, org])), [organizations]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return services.filter((service) => {
      const project = service.projectId ? projectsById.get(service.projectId) : undefined;
      const matchesEnvironment = !environment || service.environment === environment;
      const matchesOrg = !organizationId || service.organizationId === organizationId;
      const haystack = `${service.name} ${service.serviceType ?? ""} ${service.language ?? ""} ${project?.name ?? ""}`.toLowerCase();
      return matchesEnvironment && matchesOrg && (!needle || haystack.includes(needle));
    });
  }, [environment, organizationId, projectsById, query, services]);

  const connectedCount = filtered.filter((service) => connections[service.id]?.connected).length;
  const degradedCount = filtered.filter((service) => service.healthStatus === "degraded" || service.healthStatus === "down").length;
  const apiCount = filtered.filter((service) => service.serviceType === "api").length;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Service Catalog</h2>
          <p className="mt-1 text-sm text-slate-400">Operational inventory from connected projects, services, and telemetry status.</p>
        </div>
        <Button icon={<RefreshCw className="h-4 w-4" />} disabled={loading} onClick={load}>Refresh</Button>
      </div>

      {error ? <div className="rounded-lg border border-rose/40 bg-rose/10 p-3 text-sm text-rose">{error}</div> : null}

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Services" value={filtered.length} detail={`${projects.length} projects tracked`} />
        <StatCard label="Connected" value={connectedCount} detail="services with recent telemetry" />
        <StatCard label="Degraded" value={degradedCount} detail="health requires attention" />
        <StatCard label="API services" value={apiCount} detail={`environment: ${environment}`} />
      </div>

      <Card>
        <div className="grid gap-3 md:grid-cols-[1fr_220px_220px]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search service, project, language"
            className="h-10 rounded-md border border-line bg-panel-soft px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-mint focus:ring-2 focus:ring-mint/20"
          />
          <select
            value={organizationId}
            onChange={(event) => setOrganizationId(event.target.value)}
            className="h-10 rounded-md border border-line bg-panel-soft px-3 text-sm text-slate-100 outline-none focus:border-mint focus:ring-2 focus:ring-mint/20"
          >
            <option value="">All organizations</option>
            {organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
          </select>
          <div className="flex items-center justify-end gap-2 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 text-mint" />
            Live workspace data
          </div>
        </div>
      </Card>

      <div className="grid gap-3 xl:grid-cols-2">
        {filtered.map((service) => {
          const project = service.projectId ? projectsById.get(service.projectId) : undefined;
          const organization = service.organizationId ? organizationsById.get(service.organizationId) : undefined;
          const connection = connections[service.id];
          return (
            <Card key={service.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Server className="h-4 w-4 text-mint" />
                    <h3 className="truncate text-base font-semibold text-white">{service.name}</h3>
                    <StatusBadge status={service.healthStatus} />
                    <StatusBadge status={connection?.status ?? "not_connected"} />
                  </div>
                  <p className="mt-2 text-sm text-slate-400">{project?.name ?? "Unassigned project"} / {organization?.name ?? "Unknown organization"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <EnvironmentBadge environment={service.environment} />
                  <ServiceTypeBadge type={service.serviceType} />
                </div>
              </div>
              <div className="mt-4 grid gap-3 text-sm text-slate-400 md:grid-cols-4">
                <CatalogMetric label="ID" value={compactId(service.id)} />
                <CatalogMetric label="Language" value={service.language ?? "-"} />
                <CatalogMetric label="Logs 15m" value={connection?.logsLast15m ?? 0} />
                <CatalogMetric label="Metrics 15m" value={connection?.metricsLast15m ?? 0} />
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                <Activity className="h-4 w-4" />
                <span>Last log {connection?.lastLogAt ? new Date(connection.lastLogAt).toLocaleString() : "not observed"}</span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function CatalogMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs uppercase text-slate-600">{label}</p>
      <p className="mt-1 font-mono text-xs text-slate-200">{value}</p>
    </div>
  );
}
