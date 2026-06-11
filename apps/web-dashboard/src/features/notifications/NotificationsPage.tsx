import { BellRing, RefreshCw, Save, Send, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  fetchEscalationPolicies,
  fetchNotificationHistory,
  fetchNotificationSettings,
  fetchOrganizations,
  saveEscalationPolicy,
  saveNotificationSetting,
  sendNotification,
  type EscalationPolicyRecord,
  type NotificationHistoryRecord,
  type NotificationSettingRecord,
  type OrganizationRecord
} from "../../shared/api/core";
import { Badge, StatusBadge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { Card, StatCard } from "../../shared/ui/Card";
import { Input, Select, Textarea } from "../../shared/ui/FormControls";

type Provider = "email" | "slack" | "discord";

const providerOptions: Provider[] = ["email", "slack", "discord"];
const severityOptions = ["critical", "high", "medium", "low"];

export function NotificationsPage() {
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [destination, setDestination] = useState("");
  const [provider, setProvider] = useState<Provider>("slack");
  const [subject, setSubject] = useState("AegisOps alert test");
  const [message, setMessage] = useState("Notification path validated from dashboard");
  const [settings, setSettings] = useState<NotificationSettingRecord[]>([]);
  const [policies, setPolicies] = useState<EscalationPolicyRecord[]>([]);
  const [history, setHistory] = useState<NotificationHistoryRecord[]>([]);
  const [policyName, setPolicyName] = useState("Primary on-call escalation");
  const [policySeverity, setPolicySeverity] = useState("high");
  const [policyProviders, setPolicyProviders] = useState<Provider[]>(["email", "slack"]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const activeOrg = useMemo(() => organizations.find((org) => org.id === organizationId), [organizationId, organizations]);
  const currentSetting = settings.find((setting) => setting.provider.toLowerCase() === provider);

  async function loadWorkspace() {
    setLoading(true);
    setStatus("");
    try {
      const orgRows = await fetchOrganizations();
      setOrganizations(orgRows);
      const nextOrgId = organizationId || orgRows[0]?.id || "";
      setOrganizationId(nextOrgId);
      if (nextOrgId) {
        const [settingRows, policyRows, historyRows] = await Promise.all([
          fetchNotificationSettings(nextOrgId),
          fetchEscalationPolicies(nextOrgId),
          fetchNotificationHistory(nextOrgId)
        ]);
        setSettings(settingRows);
        setPolicies(policyRows);
        setHistory(historyRows);
        const providerSetting = settingRows.find((setting) => setting.provider.toLowerCase() === provider);
        if (providerSetting?.destination) setDestination(providerSetting.destination);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWorkspace();
  }, []);

  useEffect(() => {
    if (!organizationId) return;
    Promise.all([
      fetchNotificationSettings(organizationId),
      fetchEscalationPolicies(organizationId),
      fetchNotificationHistory(organizationId)
    ])
      .then(([settingRows, policyRows, historyRows]) => {
        setSettings(settingRows);
        setPolicies(policyRows);
        setHistory(historyRows);
        const providerSetting = settingRows.find((setting) => setting.provider.toLowerCase() === provider);
        setDestination(providerSetting?.destination ?? "");
      })
      .catch((error) => setStatus(error instanceof Error ? error.message : "Failed to load selected organization"));
  }, [organizationId]);

  useEffect(() => {
    setDestination(currentSetting?.destination ?? "");
  }, [currentSetting?.destination]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!organizationId) {
      setStatus("Create or select an organization before sending notifications.");
      return;
    }
    if (!destination.trim()) {
      setStatus("Add a destination for the selected provider.");
      return;
    }
    setLoading(true);
    setStatus("Saving notification route");
    try {
      await saveNotificationSetting(organizationId, {
        organizationId,
        provider: provider.toUpperCase(),
        destination: destination.trim(),
        enabled: true
      });
      const result = await sendNotification(provider, {
        organizationId,
        destination: destination.trim(),
        subject,
        message,
        payload: { source: "dashboard", organizationName: activeOrg?.name }
      });
      const [settingRows, historyRows] = await Promise.all([
        fetchNotificationSettings(organizationId),
        fetchNotificationHistory(organizationId)
      ]);
      setSettings(settingRows);
      setHistory(historyRows);
      setStatus(`Accepted by ${String(result.provider ?? provider)}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Notification test failed");
    } finally {
      setLoading(false);
    }
  }

  async function submitPolicy(event: FormEvent) {
    event.preventDefault();
    if (!organizationId) {
      setStatus("Select an organization before saving an escalation policy.");
      return;
    }
    setLoading(true);
    setStatus("Saving escalation policy");
    try {
      await saveEscalationPolicy(organizationId, {
        organizationId,
        name: policyName,
        severity: policySeverity,
        providers: policyProviders.map((item) => item.toUpperCase()),
        enabled: true
      });
      setPolicies(await fetchEscalationPolicies(organizationId));
      setStatus("Escalation policy saved");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Escalation policy save failed");
    } finally {
      setLoading(false);
    }
  }

  function togglePolicyProvider(value: Provider) {
    setPolicyProviders((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Notifications</h2>
          <p className="mt-1 text-sm text-slate-400">Workspace notification routes, escalation policies, and delivery history.</p>
        </div>
        <Button icon={<RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />} disabled={loading} onClick={loadWorkspace}>
          Refresh
        </Button>
      </div>

      {status ? <div className="rounded-lg border border-line bg-panel-soft p-3 text-sm text-slate-300">{status}</div> : null}

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Organizations" value={organizations.length} detail={activeOrg?.name ?? "none selected"} />
        <StatCard label="Routes" value={settings.length} detail="configured destinations" />
        <StatCard label="Policies" value={policies.length} detail="escalation rules" />
        <StatCard label="History" value={history.length} detail="recent provider jobs" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <div className="grid gap-5">
          <form onSubmit={submit}>
            <Card
              title="Provider Route"
              description="Save a real workspace destination and send a provider test event."
              action={<BellRing className="h-5 w-5 text-mint" aria-hidden="true" />}
            >
              <div className="grid gap-3">
                <Select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} aria-label="Organization">
                  <option value="">Select organization</option>
                  {organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                </Select>
                <Select value={provider} onChange={(event) => setProvider(event.target.value as Provider)} aria-label="Provider">
                  {providerOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </Select>
                <Input
                  value={destination}
                  onChange={(event) => setDestination(event.target.value)}
                  placeholder={provider === "email" ? "alerts@example.com" : "https://hooks.example.com/services/..."}
                  aria-label="Destination"
                />
                <Input value={subject} onChange={(event) => setSubject(event.target.value)} aria-label="Subject" />
                <Textarea value={message} onChange={(event) => setMessage(event.target.value)} aria-label="Message" />
                <Button type="submit" variant="primary" disabled={loading || !organizationId} icon={<Send className="h-4 w-4" />}>
                  Send Test
                </Button>
              </div>
            </Card>
          </form>

          <form onSubmit={submitPolicy}>
            <Card
              title="Escalation Policy"
              description="Persist provider routing by severity for incident escalation."
              action={<ShieldCheck className="h-5 w-5 text-amber" aria-hidden="true" />}
            >
              <div className="grid gap-3">
                <Input value={policyName} onChange={(event) => setPolicyName(event.target.value)} aria-label="Policy name" />
                <Select value={policySeverity} onChange={(event) => setPolicySeverity(event.target.value)} aria-label="Policy severity">
                  {severityOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </Select>
                <div className="flex flex-wrap gap-2">
                  {providerOptions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => togglePolicyProvider(item)}
                      className={`h-9 rounded-md border px-3 text-xs font-semibold ${policyProviders.includes(item) ? "border-mint bg-mint/10 text-mint" : "border-line bg-panel-soft text-slate-400 hover:text-white"}`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <Button type="submit" disabled={loading || !organizationId || policyProviders.length === 0} icon={<Save className="h-4 w-4" />}>
                  Save Policy
                </Button>
              </div>
            </Card>
          </form>
        </div>

        <div className="grid gap-5">
          <Card title="Configured Routes" description="Enabled destinations returned by the notification service.">
            <div className="grid gap-3">
              {settings.map((setting) => (
                <div key={`${setting.organizationId}-${setting.provider}-${setting.destination}`} className="rounded-lg border border-line bg-panel-soft p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{setting.provider}</p>
                    <StatusBadge status={setting.enabled ? "active" : "disabled"} />
                  </div>
                  <p className="mt-2 break-all text-sm text-slate-400">{setting.destination}</p>
                </div>
              ))}
              {settings.length === 0 ? <p className="text-sm text-slate-500">No notification routes saved for this organization.</p> : null}
            </div>
          </Card>

          <Card title="Escalation Policies" description="Incident escalation paths for the selected organization.">
            <div className="grid gap-3">
              {policies.map((policy) => (
                <div key={`${policy.organizationId}-${policy.name}`} className="rounded-lg border border-line bg-panel-soft p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{policy.name}</p>
                    <Badge tone={policy.enabled ? "success" : "muted"}>{policy.severity}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">{policy.providers.join(", ")}</p>
                </div>
              ))}
              {policies.length === 0 ? <p className="text-sm text-slate-500">No escalation policies saved yet.</p> : null}
            </div>
          </Card>

          <Card title="Notification History" description="Accepted provider jobs for the selected organization.">
            <div className="grid gap-3">
              {history.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-line bg-panel-soft p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{entry.subject}</p>
                    <StatusBadge status={entry.status.toLowerCase()} />
                  </div>
                  <p className="mt-2 break-all text-sm text-slate-400">{entry.provider} to {entry.destination}</p>
                  <p className="mt-1 text-xs text-slate-500">{new Date(entry.createdAt).toLocaleString()}</p>
                </div>
              ))}
              {history.length === 0 ? <p className="text-sm text-slate-500">No provider jobs have been accepted for this organization.</p> : null}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
