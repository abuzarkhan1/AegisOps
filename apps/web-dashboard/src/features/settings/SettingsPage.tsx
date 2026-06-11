import { Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchOrganizations } from "../../shared/api/core";
import type { OrganizationRecord } from "../../shared/api/core";
import { EmptyState } from "../../shared/ui/EmptyState";

export function SettingsPage() {
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    fetchOrganizations().then(setOrganizations).catch((err) => setError(err instanceof Error ? err.message : "Failed to load organizations"));
  }, []);

  return (
    <div className="rounded-lg border border-line bg-panel p-4 shadow-panel">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Settings</h2>
          <p className="text-sm text-slate-400">Organizations and local runtime</p>
        </div>
        <Settings className="h-5 w-5 text-mint" aria-hidden="true" />
      </div>
      {error ? <EmptyState title={error} /> : null}
      {!error && organizations.length === 0 ? <EmptyState title="No organizations found" /> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {organizations.map((organization) => (
          <div key={organization.id} className="rounded-lg border border-line bg-panel-soft p-4">
            <p className="truncate text-sm font-medium text-white">{organization.name}</p>
            <p className="mt-1 truncate text-xs text-slate-400">{organization.slug}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

