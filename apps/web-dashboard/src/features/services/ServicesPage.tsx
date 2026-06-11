import { Server, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchServices } from "../../shared/api/core";
import type { ServiceRecord } from "../../shared/api/core";
import { EmptyState } from "../../shared/ui/EmptyState";
import { StatusPill } from "../../shared/ui/StatusPill";
import { ServiceDetailPage } from "./ServiceDetailPage";

export function ServicesPage() {
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [error, setError] = useState<string>();

  useEffect(() => {
    fetchServices().then(setServices).catch((err) => setError(err instanceof Error ? err.message : "Failed to load services"));
  }, []);

  if (selectedServiceId) {
    return <ServiceDetailPage serviceId={selectedServiceId} onBack={() => setSelectedServiceId("")} />;
  }

  return (
    <div className="rounded-lg border border-line bg-panel p-4 shadow-panel">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Services</h2>
          <p className="text-sm text-slate-400">Monitored service catalog</p>
        </div>
        <Server className="h-5 w-5 text-mint" aria-hidden="true" />
      </div>
      {error ? <EmptyState title={error} /> : null}
      {!error && services.length === 0 ? <EmptyState title="No services found" /> : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {services.map((service) => (
          <div
            key={service.id}
            onClick={() => setSelectedServiceId(service.id)}
            className="rounded-lg border border-line bg-panel-soft p-4 cursor-pointer hover:border-line transition-all flex flex-col justify-between"
          >
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="truncate text-sm font-medium text-white">{service.name}</p>
                <StatusPill status={service.healthStatus === "healthy" ? "ok" : "degraded"} />
              </div>
              <p className="truncate text-xs text-slate-400">{service.repositoryUrl ?? service.language ?? service.id}</p>
            </div>
            <div className="mt-4 flex justify-end">
              <span className="inline-flex items-center gap-1 text-xs text-mint hover:underline font-semibold">
                Open Telemetry Dashboard <ExternalLink className="h-3 w-3" />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
