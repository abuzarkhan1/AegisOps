import { FormEvent, useEffect, useState } from "react";
import { Send, UsersRound } from "lucide-react";
import { fetchOrganizations, fetchTeamMembers, inviteTeamMember, type OrganizationRecord, type TeamMemberRecord } from "../../shared/api/core";
import { EmptyState } from "../../shared/ui/EmptyState";

export function TeamMembersPage() {
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [members, setMembers] = useState<TeamMemberRecord[]>([]);
  const [status, setStatus] = useState<string>();

  const orgId = organizations[0]?.id ?? "";

  async function load() {
    const orgs = await fetchOrganizations();
    setOrganizations(orgs);
    if (orgs[0]) {
      setMembers(await fetchTeamMembers(orgs[0].id));
    }
  }

  useEffect(() => {
    load().catch((error) => setStatus(error instanceof Error ? error.message : "Failed to load team"));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orgId) return;
    const form = new FormData(event.currentTarget);
    setStatus("sending invite");
    try {
      await inviteTeamMember(orgId, {
        email: String(form.get("email") ?? ""),
        name: String(form.get("name") ?? ""),
        role: String(form.get("role") ?? "engineer")
      });
      event.currentTarget.reset();
      await load();
      setStatus("member invited");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "failed");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <form onSubmit={submit} className="rounded-lg border border-line bg-panel p-5 shadow-panel">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Team Members</h2>
            <p className="text-xs text-slate-400">{organizations[0]?.name ?? "organization"}</p>
          </div>
          <UsersRound className="h-5 w-5 text-mint" />
        </div>
        <div className="grid gap-3">
          <input name="email" required type="email" placeholder="Email" className="h-10 rounded-md border border-line bg-[#0d1419] px-3 text-sm" />
          <input name="name" placeholder="Name" className="h-10 rounded-md border border-line bg-[#0d1419] px-3 text-sm" />
          <select name="role" className="h-10 rounded-md border border-line bg-[#0d1419] px-3 text-sm">
            <option value="admin">admin</option>
            <option value="engineer">engineer</option>
            <option value="viewer">viewer</option>
          </select>
          <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-mint px-4 text-sm font-semibold text-slate-950">
            <Send className="h-4 w-4" />
            Invite
          </button>
        </div>
        {status ? <p className="mt-3 text-sm text-slate-300">{status}</p> : null}
      </form>

      <div className="rounded-lg border border-line bg-panel p-5 shadow-panel">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Members</h3>
          <span className="text-xs text-slate-400">{members.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase text-slate-400">
              <tr>
                <th className="py-3 pr-4">Name</th>
                <th className="py-3 pr-4">Email</th>
                <th className="py-3 pr-4">Role</th>
                <th className="py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40">
              {members.map((member) => (
                <tr key={member.id}>
                  <td className="py-3 pr-4 font-medium text-white">{member.name}</td>
                  <td className="py-3 pr-4 text-slate-300">{member.email}</td>
                  <td className="py-3 pr-4">
                    <span className="rounded-md border border-line bg-[#0d1419] px-2 py-1 text-xs text-slate-300">{member.memberRole}</span>
                  </td>
                  <td className="py-3 text-xs text-slate-500">{new Date(member.invitedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {members.length === 0 ? <EmptyState title="No members found" /> : null}
        </div>
      </div>
    </div>
  );
}
