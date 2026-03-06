"use client";

import { useState } from "react";
import { inviteOrAddTeamMember, updateTeamMember, deleteInvite } from "./actions";

type Member = { id: string; display_name: string | null; role: string; is_active: boolean; holiday_ranges?: unknown };
type Invite = { id: string; email: string; role: string; display_name: string | null; created_at: string };

export function TeamView({
  salonId,
  members,
  invites,
  appointmentCountByStylist,
  isOwner,
}: {
  salonId: string;
  members: Member[];
  invites: Invite[];
  appointmentCountByStylist: Record<string, number>;
  isOwner: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"owner" | "stylist">("stylist");
  const [email, setEmail] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await inviteOrAddTeamMember(salonId, { display_name: displayName, role, email: email || undefined });
    setLoading(false);
    if (result.error) setError(result.error);
    else {
      setAddOpen(false);
      setDisplayName("");
      setEmail("");
      setRole("stylist");
    }
  }

  async function handleUpdateMember(e: React.FormEvent) {
    e.preventDefault();
    if (!editId) return;
    setError(null);
    setLoading(true);
    const result = await updateTeamMember(editId, { display_name: editDisplayName });
    setLoading(false);
    if (result.error) setError(result.error);
    else setEditId(null);
  }

  async function handleDeactivate(id: string) {
    if (!confirm("Deactivate this team member?")) return;
    setError(null);
    const result = await updateTeamMember(id, { is_active: false });
    if (result.error) setError(result.error);
  }

  async function handleDeleteInvite(id: string) {
    if (!confirm("Cancel this invite?")) return;
    setError(null);
    const result = await deleteInvite(id);
    if (result.error) setError(result.error);
  }

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Team</h1>
        {isOwner && (
          <button
            onClick={() => setAddOpen(true)}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background w-full sm:w-auto"
          >
            Add team member
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {members.map((m) => (
          <div
            key={m.id}
            className={`rounded-lg border border-border p-4 ${!m.is_active ? "opacity-60" : ""}`}
          >
            <div className="flex items-start justify-between gap-2 min-w-0">
              <div className="min-w-0">
                <p className="font-medium truncate">{m.display_name || m.role}</p>
                <p className="text-sm text-muted capitalize">{m.role}</p>
                <p className="mt-2 text-xs text-muted">
                  Appointments (last 30 days): {appointmentCountByStylist[m.id] ?? 0}
                </p>
              </div>
              {isOwner && m.is_active && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditId(m.id);
                      setEditDisplayName(m.display_name ?? "");
                    }}
                    className="text-sm text-accent hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeactivate(m.id)}
                    className="text-sm text-red-400 hover:underline"
                  >
                    Deactivate
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {invites.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-2">Pending invites</h2>
          <ul className="space-y-2">
            {invites.map((inv) => (
              <li key={inv.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-border px-4 py-2 min-w-0">
                <span className="text-sm truncate">{inv.email} – {inv.display_name || inv.role}</span>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => handleDeleteInvite(inv.id)}
                    className="text-sm text-red-400 hover:underline"
                  >
                    Cancel
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setAddOpen(false)}>
          <div className="w-full max-w-md rounded-lg border border-border bg-background p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Invite team member</h2>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Display name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as "owner" | "stylist")}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="stylist">Stylist</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setAddOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
                  {loading ? "Sending…" : "Send invite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditId(null)}>
          <div className="w-full max-w-md rounded-lg border border-border bg-background p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Edit member</h2>
            <form onSubmit={handleUpdateMember} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Display name</label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setEditId(null)} className="rounded-lg border border-border px-4 py-2 text-sm">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
