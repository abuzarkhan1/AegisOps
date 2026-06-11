import { FormEvent, useEffect, useState } from "react";
import { Building2, RefreshCw, Settings } from "lucide-react";
import { createOrganization, fetchOrganizations, updateOrganization, type OrganizationRecord } from "../../shared/api/core";
import { Button } from "../../shared/ui/Button";
import { Card, StatCard } from "../../shared/ui/Card";
import { Input, Select } from "../../shared/ui/FormControls";

const plans = ["free", "team", "business", "enterprise"];

export function SettingsPage() {
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setStatus("");
    try {
      setOrganizations(await fetchOrganizations());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load organizations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setStatus("Creating organization");
    try {
      await createOrganization({
        name: String(form.get("name") ?? ""),
        plan: String(form.get("plan") ?? "team")
      });
      event.currentTarget.reset();
      await load();
      setStatus("Organization created");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Organization creation failed");
    } finally {
      setLoading(false);
    }
  }

  async function submitUpdate(event: FormEvent<HTMLFormElement>, organization: OrganizationRecord) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setStatus("Updating organization");
    try {
      await updateOrganization(organization.id, {
        name: String(form.get("name") ?? ""),
        plan: String(form.get("plan") ?? organization.plan ?? "team")
      });
      await load();
      setStatus("Organization updated");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Organization update failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Settings</h2>
          <p className="mt-1 text-sm text-slate-400">Organization profiles and runtime configuration.</p>
        </div>
        <Button disabled={loading} icon={<RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />} onClick={load}>
          Refresh
        </Button>
      </div>

      {status ? <div className="rounded-lg border border-line bg-panel-soft p-3 text-sm text-slate-300">{status}</div> : null}

      <div className="grid gap-3 md:grid-cols-3">
        <StatCard label="Organizations" value={organizations.length} detail="workspace records" />
        <StatCard label="Plans" value={new Set(organizations.map((org) => org.plan ?? "workspace")).size} detail="distinct plans" />
        <StatCard label="Runtime" value="API" detail="served by core service" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <form onSubmit={submitCreate}>
          <Card title="Create Organization" description="Add a workspace record through the core API." action={<Building2 className="h-5 w-5 text-mint" />}>
            <div className="grid gap-3">
              <Input name="name" required placeholder="Organization name" />
              <Select name="plan" defaultValue="team" aria-label="Plan">
                {plans.map((plan) => <option key={plan} value={plan}>{plan}</option>)}
              </Select>
              <Button type="submit" variant="primary" disabled={loading} icon={<Settings className="h-4 w-4" />}>
                Create
              </Button>
            </div>
          </Card>
        </form>

        <Card title="Organizations" description="Update organization name and plan.">
          <div className="grid gap-3 md:grid-cols-2">
            {organizations.map((organization) => (
              <form key={organization.id} onSubmit={(event) => submitUpdate(event, organization)} className="rounded-lg border border-line bg-panel-soft p-4">
                <p className="truncate text-sm font-semibold text-white">{organization.slug}</p>
                <p className="mt-1 truncate text-xs text-slate-500">{organization.id}</p>
                <div className="mt-3 grid gap-3">
                  <Input name="name" required defaultValue={organization.name} />
                  <Select name="plan" defaultValue={organization.plan ?? "team"} aria-label={`Plan for ${organization.name}`}>
                    {plans.map((plan) => <option key={plan} value={plan}>{plan}</option>)}
                  </Select>
                  <Button type="submit" size="sm" disabled={loading}>
                    Save
                  </Button>
                </div>
              </form>
            ))}
            {organizations.length === 0 ? <p className="text-sm text-slate-500">No organizations found.</p> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
