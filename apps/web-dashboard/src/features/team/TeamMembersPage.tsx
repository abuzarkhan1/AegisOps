import { FormEvent, useEffect, useState } from "react";
import { RefreshCw, Send, Trash2, UsersRound } from "lucide-react";
import {
  fetchOrganizations,
  fetchTeamMembers,
  inviteTeamMember,
  removeTeamMember,
  updateTeamMemberRole,
  type OrganizationRecord,
  type TeamMemberRecord
} from "../../shared/api/core";
import { StatusBadge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { Card, StatCard } from "../../shared/ui/Card";
import { Input, Select } from "../../shared/ui/FormControls";

const roles = ["admin", "engineer", "viewer"];

export function TeamMembersPage() {
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [members, setMembers] = useState<TeamMemberRecord[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function load(nextOrgId = selectedOrgId) {
    setLoading(true);
    setStatus("");
    try {
      const orgs = await fetchOrganizations();
      setOrganizations(orgs);
      const orgId = nextOrgId || orgs[0]?.id || "";
      setSelectedOrgId(orgId);
      setMembers(orgId ? await fetchTeamMembers(orgId) : []);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load team");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrgId) return;
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setStatus("Sending invite");
    try {
      await inviteTeamMember(selectedOrgId, {
        email: String(form.get("email") ?? ""),
        name: String(form.get("name") ?? ""),
        role: String(form.get("role") ?? "engineer")
      });
      event.currentTarget.reset();
      await load(selectedOrgId);
      setStatus("Member invited");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Invite failed");
    } finally {
      setLoading(false);
    }
  }

  async function changeRole(member: TeamMemberRecord, role: string) {
    if (!selectedOrgId) return;
    setLoading(true);
    setStatus("Updating role");
    try {
      await updateTeamMemberRole(selectedOrgId, member.id, role);
      await load(selectedOrgId);
      setStatus("Role updated");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Role update failed");
    } finally {
      setLoading(false);
    }
  }

  async function removeMember(member: TeamMemberRecord) {
    if (!selectedOrgId || !window.confirm(`Remove ${member.email} from this organization?`)) return;
    setLoading(true);
    setStatus("Removing member");
    try {
      await removeTeamMember(selectedOrgId, member.id);
      await load(selectedOrgId);
      setStatus("Member removed");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Remove member failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Team</h2>
          <p className="mt-1 text-sm text-slate-400">Invite, update, and remove organization members.</p>
        </div>
        <Button disabled={loading} icon={<RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />} onClick={() => load()}>
          Refresh
        </Button>
      </div>

      {status ? <div className="rounded-lg border border-line bg-panel-soft p-3 text-sm text-slate-300">{status}</div> : null}

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Organizations" value={organizations.length} detail="available workspaces" />
        <StatCard label="Members" value={members.length} detail="selected organization" />
        <StatCard label="Admins" value={members.filter((member) => member.memberRole === "admin").length} detail="owner permissions" />
        <StatCard label="Engineers" value={members.filter((member) => member.memberRole === "engineer").length} detail="operational users" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <form onSubmit={submit}>
          <Card title="Invite Member" description="Create or attach a user to the selected organization." action={<UsersRound className="h-5 w-5 text-mint" />}>
            <div className="grid gap-3">
              <Select value={selectedOrgId} onChange={(event) => load(event.target.value)} aria-label="Organization">
                <option value="">Select organization</option>
                {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
              </Select>
              <Input name="email" required type="email" placeholder="Email" />
              <Input name="name" placeholder="Name" />
              <Select name="role" defaultValue="engineer" aria-label="Role">
                {roles.map((role) => <option key={role} value={role}>{role}</option>)}
              </Select>
              <Button type="submit" variant="primary" disabled={loading || !selectedOrgId} icon={<Send className="h-4 w-4" />}>
                Invite
              </Button>
            </div>
          </Card>
        </form>

        <Card title="Members" description="Role changes and removals are persisted through the core API.">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-3 pr-4">Name</th>
                  <th className="py-3 pr-4">Email</th>
                  <th className="py-3 pr-4">Role</th>
                  <th className="py-3 pr-4">Joined</th>
                  <th className="py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40">
                {members.map((member) => (
                  <tr key={member.id}>
                    <td className="py-3 pr-4 font-medium text-white">{member.name}</td>
                    <td className="py-3 pr-4 text-slate-300">{member.email}</td>
                    <td className="py-3 pr-4">
                      <Select value={member.memberRole} onChange={(event) => changeRole(member, event.target.value)} className="h-8 min-w-28 text-xs" aria-label={`Role for ${member.email}`}>
                        {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                      </Select>
                    </td>
                    <td className="py-3 pr-4 text-xs text-slate-500">{new Date(member.invitedAt).toLocaleString()}</td>
                    <td className="py-3">
                      <Button type="button" size="sm" variant="danger" disabled={loading} icon={<Trash2 className="h-4 w-4" />} onClick={() => removeMember(member)}>
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {members.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-line p-4 text-sm text-slate-500">
                No members found for the selected organization.
              </div>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {roles.map((role) => <StatusBadge key={role} status={role} />)}
          </div>
        </Card>
      </div>
    </div>
  );
}
