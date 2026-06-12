import { Copy, KeyRound, RefreshCw, RotateCw, ShieldCheck, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  createManagedApiKey,
  fetchApiKeys,
  fetchOrganizations,
  fetchServiceConnectionStatus,
  fetchServices,
  revokeApiKey,
  rotateApiKey,
  type ApiKeyRecord,
  type ApiKeyWithSecret,
  type OrganizationRecord,
  type ServiceConnectionStatus,
  type ServiceRecord
} from "../../shared/api/core";
import { EmptyState } from "../../shared/ui/EmptyState";

type RevealedKey = {
  apiKey: ApiKeyWithSecret;
  action: "created" | "rotated";
};

const formatDate = (value?: string) => (value ? new Date(value).toLocaleString() : "Never");
const compactId = (value?: string) => (value ? `${value.slice(0, 8)}...${value.slice(-4)}` : "organization");
const maskedKey = (apiKey: ApiKeyRecord) => `${apiKey.prefix}...${apiKey.status === "active" ? "active" : "revoked"}`;

const statusClass = (status: string) => {
  if (status === "active") return "border-white/20 bg-white/10 text-white";
  if (status === "revoked") return "border-rose-500/30 bg-rose-500/10 text-rose-300";
  return "border-white/10 bg-white/5 text-text-soft";
};

const connectionClass = (status?: string) => {
  if (status === "connected") return "border-white/20 bg-white/10 text-white";
  if (status === "erroring" || status === "stale") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  return "border-white/10 bg-white/5 text-text-soft";
};

export function ApiKeysPage() {
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [connectionStatuses, setConnectionStatuses] = useState<Record<string, ServiceConnectionStatus>>({});
  const [organizationId, setOrganizationId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [name, setName] = useState("production ingestion key");
  const [revealedKey, setRevealedKey] = useState<RevealedKey>();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState(false);

  const servicesById = useMemo(() => new Map(services.map((service) => [service.id, service])), [services]);
  const filteredServices = useMemo(
    () => services.filter((service) => !organizationId || !service.organizationId || service.organizationId === organizationId),
    [organizationId, services]
  );
  const activeCount = apiKeys.filter((apiKey) => apiKey.status === "active").length;
  const revokedCount = apiKeys.filter((apiKey) => apiKey.status === "revoked").length;
  const usedCount = apiKeys.filter((apiKey) => apiKey.lastUsedAt).length;

  async function loadConnectionStatuses(rows: ApiKeyRecord[]) {
    const serviceIds = Array.from(new Set(rows.map((apiKey) => apiKey.serviceId).filter(Boolean))) as string[];
    const entries = await Promise.all(
      serviceIds.map(async (id) => {
        try {
          return [id, await fetchServiceConnectionStatus(id)] as const;
        } catch {
          return [id, { serviceId: id, connected: false, status: "erroring" }] as const;
        }
      })
    );
    setConnectionStatuses(Object.fromEntries(entries));
  }

  async function loadKeys(nextOrganizationId = organizationId, nextServiceId = serviceId) {
    setLoading(true);
    try {
      const rows = await fetchApiKeys({ organizationId: nextOrganizationId, serviceId: nextServiceId });
      setApiKeys(rows);
      await loadConnectionStatuses(rows);
      setStatus(rows.length ? `${rows.length} API keys loaded` : "No API keys match the current scope");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function boot() {
      const [orgRows, serviceRows] = await Promise.all([fetchOrganizations(), fetchServices()]);
      const initialOrgId = orgRows[0]?.id ?? "";
      setOrganizations(orgRows);
      setServices(serviceRows);
      setOrganizationId(initialOrgId);
      await loadKeys(initialOrgId, "");
    }

    boot().catch((error) => setStatus(error instanceof Error ? error.message : "Failed to load API key data"));
  }, []);

  async function copyRawKey(rawKey: string) {
    await navigator.clipboard.writeText(rawKey);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function handleScopeChange(nextOrganizationId: string, nextServiceId = "") {
    setOrganizationId(nextOrganizationId);
    setServiceId(nextServiceId);
    setRevealedKey(undefined);
    await loadKeys(nextOrganizationId, nextServiceId);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!organizationId || !name.trim() || loading) return;

    setLoading(true);
    setStatus("creating API key");
    try {
      const result = await createManagedApiKey({
        organizationId,
        serviceId: serviceId || undefined,
        name
      });
      setRevealedKey({ apiKey: result.apiKey, action: "created" });
      setName(result.apiKey.name);
      await loadKeys(organizationId, serviceId);
      setStatus("API key created");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create API key");
    } finally {
      setLoading(false);
    }
  }

  async function rotate(apiKey: ApiKeyRecord) {
    if (apiKey.status !== "active" || !window.confirm(`Rotate ${apiKey.name}?`)) return;
    setLoading(true);
    setStatus("rotating API key");
    try {
      const result = await rotateApiKey(apiKey.id);
      setRevealedKey({ apiKey: result.apiKey, action: "rotated" });
      await loadKeys(organizationId, serviceId);
      setStatus("API key rotated");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to rotate API key");
    } finally {
      setLoading(false);
    }
  }

  async function revoke(apiKey: ApiKeyRecord) {
    if (apiKey.status !== "active" || !window.confirm(`Revoke ${apiKey.name}?`)) return;
    setLoading(true);
    setStatus("revoking API key");
    try {
      await revokeApiKey(apiKey.id);
      if (revealedKey?.apiKey.id === apiKey.id) setRevealedKey(undefined);
      await loadKeys(organizationId, serviceId);
      setStatus("API key revoked");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to revoke API key");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <aside className="space-y-4">
        <form onSubmit={submit} className="aegis-glass rounded-2xl p-5 shadow-panel">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">API Keys</h2>
              <p className="text-xs text-text-soft">Ingestion credentials</p>
            </div>
            <KeyRound className="h-5 w-5 text-white" />
          </div>

          <div className="grid gap-3">
            <label className="text-xs font-semibold uppercase text-text-soft">
              Organization
              <select
                value={organizationId}
                onChange={(event) => handleScopeChange(event.target.value)}
                className="mt-1 h-10 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm normal-case text-white"
              >
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold uppercase text-text-soft">
              Service Scope
              <select
                value={serviceId}
                onChange={(event) => handleScopeChange(organizationId, event.target.value)}
                className="mt-1 h-10 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm normal-case text-white"
              >
                <option value="">Organization-wide</option>
                {filteredServices.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold uppercase text-text-soft">
              Key Name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1 h-10 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm normal-case text-white"
                placeholder="production ingestion key"
              />
            </label>
            <button
              type="submit"
              disabled={!organizationId || !name.trim() || loading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-black disabled:opacity-50"
            >
              <KeyRound className="h-4 w-4" />
              Create Key
            </button>
          </div>
          {status ? <p className="mt-3 text-sm text-text-soft">{status}</p> : null}
        </form>

        {revealedKey ? (
          <section className="rounded-2xl border border-amber-500/30 bg-amber/10 p-5 shadow-panel">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase text-amber-300">{revealedKey.action} key</p>
                <h3 className="mt-1 text-sm font-semibold text-white">{revealedKey.apiKey.name}</h3>
              </div>
              <button
                type="button"
                title="Copy raw API key"
                onClick={() => copyRawKey(revealedKey.apiKey.rawKey)}
                className="grid h-9 w-9 place-items-center rounded-full border border-amber-500/30 bg-white/5 text-amber-200 hover:text-white"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <code className="mt-4 block overflow-x-auto rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-text-primary">
              {revealedKey.apiKey.rawKey}
            </code>
            <p className="mt-2 text-xs text-text-soft">{copied ? "Copied" : "Prefix " + revealedKey.apiKey.prefix}</p>
          </section>
        ) : null}

        <div className="grid grid-cols-3 gap-3">
          <div className="aegis-glass rounded-2xl p-3 shadow-panel">
            <p className="text-xs uppercase text-text-soft">Active</p>
            <p className="mt-1 text-xl font-bold text-white">{activeCount}</p>
          </div>
          <div className="aegis-glass rounded-2xl p-3 shadow-panel">
            <p className="text-xs uppercase text-text-soft">Used</p>
            <p className="mt-1 text-xl font-bold text-white">{usedCount}</p>
          </div>
          <div className="aegis-glass rounded-2xl p-3 shadow-panel">
            <p className="text-xs uppercase text-text-soft">Revoked</p>
            <p className="mt-1 text-xl font-bold text-rose-300">{revokedCount}</p>
          </div>
        </div>
      </aside>

      <main className="aegis-glass rounded-2xl p-5 shadow-panel">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white">Key Registry</h3>
            <p className="text-xs text-text-soft">{organizationId ? compactId(organizationId) : "No organization selected"}</p>
          </div>
          <button
            type="button"
            onClick={() => loadKeys()}
            disabled={loading}
            title="Refresh API keys"
            className="grid h-9 w-9 place-items-center rounded-2xl border border-white/10 bg-white/5 text-text-soft hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {apiKeys.length === 0 ? <EmptyState title="No API keys found" /> : null}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase text-text-soft">
              <tr>
                <th className="py-3 pr-4">Name</th>
                <th className="py-3 pr-4">Key</th>
                <th className="py-3 pr-4">Scope</th>
                <th className="py-3 pr-4">Last Used</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40">
              {apiKeys.map((apiKey) => {
                const service = apiKey.serviceId ? servicesById.get(apiKey.serviceId) : undefined;
                const connection = apiKey.serviceId ? connectionStatuses[apiKey.serviceId] : undefined;
                return (
                  <tr key={apiKey.id}>
                    <td className="py-3 pr-4">
                      <div className="font-medium text-white">{apiKey.name}</div>
                      <div className="text-xs text-text-muted">Created {formatDate(apiKey.createdAt)}</div>
                    </td>
                    <td className="py-3 pr-4">
                      <code className="rounded-2xl border border-white/10 bg-white/5 px-2 py-1 text-xs text-text-soft">
                        {maskedKey(apiKey)}
                      </code>
                    </td>
                    <td className="py-3 pr-4 text-text-soft">
                      <div>{service?.name ?? "organization-wide"}</div>
                      <div className="font-mono text-xs text-text-muted">{compactId(apiKey.serviceId)}</div>
                    </td>
                    <td className="py-3 pr-4 text-xs text-text-soft">{formatDate(apiKey.lastUsedAt)}</td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-col gap-2">
                        <span className={`w-fit rounded-full border px-2 py-1 text-xs font-semibold ${statusClass(apiKey.status)}`}>
                          {apiKey.status}
                        </span>
                        {apiKey.serviceId ? (
                          <span
                            className={`inline-flex w-fit items-center gap-1 rounded-full border px-2 py-1 text-xs ${connectionClass(connection?.status)}`}
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            {connection?.status ?? "checking"}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          title="Rotate API key"
                          onClick={() => rotate(apiKey)}
                          disabled={apiKey.status !== "active" || loading}
                          className="grid h-9 w-9 place-items-center rounded-2xl border border-white/10 bg-white/5 text-text-soft hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <RotateCw className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Revoke API key"
                          onClick={() => revoke(apiKey)}
                          disabled={apiKey.status !== "active" || loading}
                          className="grid h-9 w-9 place-items-center rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
