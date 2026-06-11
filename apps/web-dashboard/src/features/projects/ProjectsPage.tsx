import { FormEvent, useEffect, useMemo, useState } from "react";
import { FolderKanban, KeyRound, Plus, Server, Wand2, ExternalLink } from "lucide-react";
import {
  createApiKey,
  createProject,
  createService,
  fetchOrganizations,
  fetchProjects,
  fetchServices,
  type OrganizationRecord,
  type ProjectRecord,
  type ServiceRecord
} from "../../shared/api/core";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ProjectDetailPage } from "./ProjectDetailPage";
import { ServiceDetailPage } from "../services/ServiceDetailPage";

export function ProjectsPage() {
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [status, setStatus] = useState<string>();
  const [generatedKey, setGeneratedKey] = useState<string>();

  const [viewingProjectDetail, setViewingProjectDetail] = useState(false);
  const [viewingServiceId, setViewingServiceId] = useState("");

  const selectedOrgId = organizations[0]?.id ?? "";
  const selectedProject = useMemo(() => projects.find((project) => project.id === selectedProjectId), [projects, selectedProjectId]);
  const projectServices = services.filter((service) => service.projectId === selectedProjectId);

  async function load() {
    const [orgs, projectList, serviceList] = await Promise.all([fetchOrganizations(), fetchProjects(), fetchServices()]);
    setOrganizations(orgs);
    setProjects(projectList);
    setServices(serviceList);
    if (!selectedProjectId && projectList[0]) setSelectedProjectId(projectList[0].id);
  }

  useEffect(() => {
    load().catch((error) => setStatus(error instanceof Error ? error.message : "Failed to load projects"));
  }, []);

  async function submitProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrgId) return;
    const form = new FormData(event.currentTarget);
    setStatus("creating project");
    try {
      await createProject({
        organizationId: selectedOrgId,
        name: String(form.get("name") ?? ""),
        projectKey: String(form.get("projectKey") ?? ""),
        environment: String(form.get("environment") ?? "dev"),
        description: String(form.get("description") ?? "")
      });
      event.currentTarget.reset();
      await load();
      setStatus("project created");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "failed");
    }
  }

  async function submitService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProjectId) return;
    const form = new FormData(event.currentTarget);
    setStatus("creating service");
    try {
      await createService(selectedProjectId, {
        name: String(form.get("name") ?? ""),
        environment: selectedProject?.environment ?? "production",
        serviceType: String(form.get("serviceType") ?? "api"),
        language: String(form.get("language") ?? ""),
        repositoryUrl: String(form.get("repositoryUrl") ?? "")
      });
      event.currentTarget.reset();
      await load();
      setStatus("service created");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "failed");
    }
  }

  async function generateKey(service: ServiceRecord) {
    setGeneratedKey(undefined);
    setStatus("generating api key");
    try {
      const result = await createApiKey(service.id, `${service.name} ingestion key`);
      setGeneratedKey(result.apiKey.rawKey);
      setStatus("api key generated");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "failed");
    }
  }

  if (viewingServiceId) {
    return <ServiceDetailPage serviceId={viewingServiceId} onBack={() => setViewingServiceId("")} />;
  }

  if (viewingProjectDetail && selectedProject) {
    return (
      <ProjectDetailPage
        project={selectedProject}
        onBack={() => setViewingProjectDetail(false)}
        onSelectService={(sId) => setViewingServiceId(sId)}
      />
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
      <div className="space-y-4">
        <form onSubmit={submitProject} className="rounded-lg border border-line bg-panel p-5 shadow-panel">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Projects</h2>
            <FolderKanban className="h-5 w-5 text-mint" />
          </div>
          <div className="grid gap-3">
            <input name="name" required placeholder="Project name" className="h-10 rounded-md border border-line bg-panel-soft px-3 text-sm" />
            <input name="projectKey" placeholder="project-key" className="h-10 rounded-md border border-line bg-panel-soft px-3 text-sm" />
            <select name="environment" className="h-10 rounded-md border border-line bg-panel-soft px-3 text-sm">
              <option value="dev">dev</option>
              <option value="staging">staging</option>
              <option value="production">production</option>
            </select>
            <input name="description" placeholder="Description" className="h-10 rounded-md border border-line bg-panel-soft px-3 text-sm" />
            <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-mint px-4 text-sm font-semibold text-slate-950">
              <Plus className="h-4 w-4" />
              Create Project
            </button>
          </div>
        </form>

        <div className="rounded-lg border border-line bg-panel p-5 shadow-panel">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Project Catalog</h3>
            <span className="text-xs text-slate-400">{projects.length}</span>
          </div>
          <div className="space-y-2">
            {projects.map((project) => {
              const serviceCount = services.filter((service) => service.projectId === project.id).length;
              const mode = serviceCount <= 1 ? "monolith" : "microservices";
              return (
                <div
                  key={project.id}
                  onClick={() => setSelectedProjectId(project.id)}
                  className={`w-full rounded-md border p-3 text-left text-sm cursor-pointer transition-all ${
                    selectedProjectId === project.id ? "border-mint/50 bg-mint/10" : "border-line bg-panel-soft hover:border-line"
                  }`}
                >
                  <span className="block truncate font-medium text-white">{project.name}</span>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-slate-400">{project.projectKey ?? project.environment} · {mode}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProjectId(project.id);
                        setViewingProjectDetail(true);
                      }}
                      className="inline-flex items-center gap-1 text-xs text-mint hover:underline"
                    >
                      Open Dashboard <ExternalLink className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
            {projects.length === 0 ? <EmptyState title="No projects yet" /> : null}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <form onSubmit={submitService} className="rounded-lg border border-line bg-panel p-5 shadow-panel">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">{selectedProject?.name ?? "Project Services"}</h2>
              <p className="text-xs text-slate-400">{selectedProject?.environment ?? "select a project"}</p>
            </div>
            <Server className="h-5 w-5 text-amber" />
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_140px_140px]">
            <input name="name" required placeholder="Service name" className="h-10 rounded-md border border-line bg-panel-soft px-3 text-sm" />
            <select name="serviceType" className="h-10 rounded-md border border-line bg-panel-soft px-3 text-sm">
              <option value="api">api</option>
              <option value="frontend">frontend</option>
              <option value="worker">worker</option>
              <option value="database">database</option>
              <option value="db">db</option>
              <option value="queue">queue</option>
              <option value="cache">cache</option>
              <option value="message-broker">message-broker</option>
              <option value="external">external</option>
            </select>
            <select name="language" className="h-10 rounded-md border border-line bg-panel-soft px-3 text-sm">
              <option value="node">node</option>
              <option value="go">go</option>
              <option value="python">python</option>
              <option value="java">java</option>
            </select>
            <input name="repositoryUrl" placeholder="Repository URL" className="h-10 rounded-md border border-line bg-panel-soft px-3 text-sm md:col-span-2" />
            <button disabled={!selectedProjectId} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-amber px-4 text-sm font-semibold text-slate-950 disabled:opacity-50">
              <Plus className="h-4 w-4" />
              Add Service
            </button>
          </div>
        </form>

        <div className="rounded-lg border border-line bg-panel p-5 shadow-panel">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Services</h3>
            <Wand2 className="h-4 w-4 text-slate-400" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {projectServices.map((service) => (
              <div key={service.id} className="rounded-lg border border-line bg-panel-soft p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <button
                      onClick={() => setViewingServiceId(service.id)}
                      className="truncate text-sm font-semibold text-white hover:text-mint hover:underline text-left block"
                    >
                      {service.name}
                    </button>
                    <p className="mt-1 text-xs text-slate-400">{service.serviceType ?? "api"} · {service.language ?? "runtime"}</p>
                  </div>
                  <div className="flex gap-2">
                    <button title="Generate API key" onClick={() => generateKey(service)} className="grid h-9 w-9 place-items-center rounded-md border border-line bg-panel-soft text-slate-300 hover:text-white">
                      <KeyRound className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span className="truncate max-w-[180px]">{service.repositoryUrl ?? service.id}</span>
                  <button
                    onClick={() => setViewingServiceId(service.id)}
                    className="inline-flex items-center gap-1 text-mint hover:underline"
                  >
                    View Details <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
            {projectServices.length === 0 ? <EmptyState title="No services in this project" /> : null}
          </div>
        </div>

        {status ? <p className="text-sm text-slate-300">{status}</p> : null}
        {generatedKey ? (
          <div className="rounded-lg border border-mint/30 bg-mint/10 p-4">
            <p className="text-xs font-semibold uppercase text-mint">New API Key</p>
            <p className="mt-2 break-all font-mono text-xs text-slate-200">{generatedKey}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
