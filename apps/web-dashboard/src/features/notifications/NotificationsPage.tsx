import { BellRing } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { fetchNotificationHistory, saveNotificationSetting, sendNotification } from "../../shared/api/core";
import type { NotificationHistoryRecord } from "../../shared/api/core";
import { EmptyState } from "../../shared/ui/EmptyState";

export function NotificationsPage() {
  const [organizationId, setOrganizationId] = useState("local");
  const [destination, setDestination] = useState("mock://local");
  const [provider, setProvider] = useState<"email" | "slack" | "discord">("slack");
  const [history, setHistory] = useState<NotificationHistoryRecord[]>([]);
  const [status, setStatus] = useState<string>();

  async function loadHistory() {
    setHistory(await fetchNotificationHistory());
  }

  useEffect(() => {
    loadHistory().catch((error) => setStatus(error instanceof Error ? error.message : "Failed to load history"));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus("saving");
    try {
      await saveNotificationSetting(organizationId, {
        organizationId,
        provider: provider.toUpperCase(),
        destination,
        enabled: true
      });
      const result = await sendNotification(provider, {
        organizationId,
        destination,
        subject: "AegisOps alert test",
        message: "Notification path validated from dashboard",
        payload: { source: "dashboard" }
      });
      setStatus(`accepted -> ${String(result.provider ?? provider)}`);
      await loadHistory();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "failed");
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <form onSubmit={submit} className="rounded-lg border border-line bg-panel p-4 shadow-panel">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Notifications</h2>
            <p className="text-sm text-slate-400">Email, Slack, Discord, escalation</p>
          </div>
          <BellRing className="h-5 w-5 text-mint" aria-hidden="true" />
        </div>
        <div className="grid gap-3">
          <input className="h-10 rounded-md border border-line bg-panel-soft px-3 text-sm" value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} />
          <select className="h-10 rounded-md border border-line bg-panel-soft px-3 text-sm" value={provider} onChange={(event) => setProvider(event.target.value as "email" | "slack" | "discord")}>
            <option value="email">Email</option>
            <option value="slack">Slack</option>
            <option value="discord">Discord</option>
          </select>
          <input className="h-10 rounded-md border border-line bg-panel-soft px-3 text-sm" value={destination} onChange={(event) => setDestination(event.target.value)} />
          <button className="h-10 rounded-md bg-mint px-4 text-sm font-medium text-slate-950" type="submit">Send Test</button>
        </div>
        {status ? <p className="mt-3 text-sm text-slate-300">{status}</p> : null}
      </form>

      <section className="rounded-lg border border-line bg-panel p-4 shadow-panel">
        <div className="mb-4">
          <h2 className="text-base font-semibold">Notification History</h2>
          <p className="text-sm text-slate-400">Accepted provider jobs</p>
        </div>
        {history.length === 0 ? <EmptyState title="No notification history" /> : null}
        <div className="grid gap-3">
          {history.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-line bg-panel-soft p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-white">{entry.subject}</p>
                <span className="rounded-md bg-panel-hover px-2 py-1 text-xs text-slate-300">{entry.provider}</span>
              </div>
              <p className="mt-2 text-sm text-slate-400">{entry.destination}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
