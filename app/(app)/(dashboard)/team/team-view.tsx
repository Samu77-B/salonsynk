"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { inviteOrAddTeamMember, updateTeamMember, deleteInvite, uploadTeamMemberAvatar, updateSalonTeamRoles } from "./actions";

type Member = { id: string; display_name: string | null; role: string; is_active: boolean; holiday_ranges?: unknown; employment_type?: string; avatar_url?: string | null };
type Invite = { id: string; email: string; role: string; display_name: string | null; created_at: string };

const BUILTIN_ROLES = [
  { value: "stylist", label: "Stylist" },
  { value: "owner", label: "Owner" },
] as const;

export function TeamView({
  salonId,
  members,
  invites,
  appointmentCountByStylist,
  isOwner,
  customRoles = [],
}: {
  salonId: string;
  members: Member[];
  invites: Invite[];
  appointmentCountByStylist: Record<string, number>;
  isOwner: boolean;
  customRoles?: string[];
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<string>("stylist");
  const [email, setEmail] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editRole, setEditRole] = useState<string>("stylist");
  const [editEmploymentType, setEditEmploymentType] = useState<"EMPLOYEE" | "RENTER">("EMPLOYEE");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [rolesLoading, setRolesLoading] = useState(false);
  const editAvatarInputRef = useRef<HTMLInputElement>(null);
  const addAvatarInputRef = useRef<HTMLInputElement>(null);

  const roleOptions = [...BUILTIN_ROLES, ...customRoles.map((r) => ({ value: r, label: r }))];

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await inviteOrAddTeamMember(salonId, { display_name: displayName, role, email: email || undefined });
    if (result.error) {
      setLoading(false);
      setError(result.error);
      return;
    }
    const avatarFile = addAvatarInputRef.current?.files?.[0];
    if (result.memberId && avatarFile && isOwner) {
      const formData = new FormData();
      formData.append("avatar", avatarFile);
      const uploadResult = await uploadTeamMemberAvatar(salonId, result.memberId, formData);
      if (uploadResult.error) setError(uploadResult.error);
    }
    setLoading(false);
    setAddOpen(false);
    setDisplayName("");
    setEmail("");
    setRole("stylist");
    addAvatarInputRef.current && (addAvatarInputRef.current.value = "");
  }

  async function handleUpdateMember(e: React.FormEvent) {
    e.preventDefault();
    if (!editId) return;
    setError(null);
    setLoading(true);
    const avatarFile = editAvatarInputRef.current?.files?.[0];
    if (avatarFile && isOwner) {
      const formData = new FormData();
      formData.append("avatar", avatarFile);
      const uploadResult = await uploadTeamMemberAvatar(salonId, editId, formData);
      if (uploadResult.error) {
        setError(uploadResult.error);
        setLoading(false);
        return;
      }
    }
    const result = await updateTeamMember(editId, {
      display_name: editDisplayName,
      ...(isOwner ? { employment_type: editEmploymentType, role: editRole } : {}),
    });
    setLoading(false);
    if (result.error) setError(result.error);
    else {
      setEditId(null);
      editAvatarInputRef.current && (editAvatarInputRef.current.value = "");
    }
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

  async function handleAddRole() {
    const name = newRoleName.trim();
    if (!name) return;
    setError(null);
    setRolesLoading(true);
    const result = await updateSalonTeamRoles(salonId, [...customRoles, name]);
    setRolesLoading(false);
    if (result.error) setError(result.error);
    else setNewRoleName("");
  }

  async function handleRemoveRole(roleName: string) {
    setError(null);
    setRolesLoading(true);
    await updateSalonTeamRoles(salonId, customRoles.filter((r) => r !== roleName));
    setRolesLoading(false);
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

      {isOwner && (
        <section className="rounded-lg border border-border p-4">
          <h2 className="text-lg font-semibold mb-2">Manage roles</h2>
          <p className="text-sm text-muted mb-3">Add role names that you can assign when adding or editing team members (e.g. Receptionist, Senior Stylist).</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {customRoles.map((r) => (
              <span
                key={r}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm"
              >
                {r}
                <button
                  type="button"
                  onClick={() => handleRemoveRole(r)}
                  disabled={rolesLoading}
                  className="ml-1 rounded-full hover:bg-background/80 disabled:opacity-50"
                  aria-label={`Remove role ${r}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="e.g. Receptionist"
              aria-label="New role name"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm flex-1 min-w-0"
            />
            <button
              type="button"
              onClick={handleAddRole}
              disabled={rolesLoading || !newRoleName.trim()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
            >
              Add role
            </button>
          </div>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {members.map((m) => (
          <div
            key={m.id}
            className={`rounded-lg border border-border p-4 ${!m.is_active ? "opacity-60" : ""}`}
          >
            <div className="flex items-start justify-between gap-2 min-w-0">
              <div className="flex gap-3 min-w-0 flex-1">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted">
                  {m.avatar_url ? (
                    <Image
                      src={m.avatar_url}
                      alt={m.display_name || "Team member"}
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-lg font-medium text-muted-foreground">
                      {(m.display_name || m.role).charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{m.display_name || m.role}</p>
                  <p className="text-sm text-muted capitalize">{m.role}</p>
                  {m.role === "stylist" && (
                    <p className="text-xs text-muted">
                      {(m.employment_type as string) === "RENTER" ? "Renter" : "Employee"}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted">
                    Appointments (last 30 days): {appointmentCountByStylist[m.id] ?? 0}
                  </p>
                </div>
              </div>
              {isOwner && m.is_active && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditId(m.id);
                      setEditDisplayName(m.display_name ?? "");
                      setEditRole(m.role || "stylist");
                      setEditEmploymentType((m.employment_type as "EMPLOYEE" | "RENTER") || "EMPLOYEE");
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
            <h2 className="text-lg font-semibold mb-4">Add team member</h2>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Display name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Jane Smith"
                  aria-label="Display name"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email (optional)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Invite by email later"
                  aria-label="Email (optional)"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <p className="text-xs text-muted mt-1">Leave blank to add them without an account. You can invite by email later.</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  aria-label="Role"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  {roleOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              {isOwner && (
                <div>
                  <label className="block text-sm font-medium mb-1">Profile image (optional)</label>
                  <input
                    ref={addAvatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    aria-label="Upload profile image"
                    className="block w-full text-sm text-muted file:mr-2 file:rounded file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-background"
                  />
                  <p className="text-xs text-muted mt-1">JPEG, PNG, GIF or WebP. Max 2MB.</p>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setAddOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm">
                  Cancel
                </button>
                <button type="submit" disabled={loading || !displayName.trim()} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
                  {loading ? "Adding…" : email.trim() ? "Send invite" : "Add member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editId && (() => {
        const member = members.find((m) => m.id === editId);
        const editRoleOptions = member && !roleOptions.some((o) => o.value === member.role)
          ? [...roleOptions, { value: member.role, label: member.role }]
          : roleOptions;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditId(null)}>
            <div className="w-full max-w-md rounded-lg border border-border bg-background p-6" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4">Edit member</h2>
              <form onSubmit={handleUpdateMember} className="space-y-4">
                {isOwner && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Profile image</label>
                    <div className="flex items-center gap-4">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
                        {member?.avatar_url ? (
                          <Image
                            src={member.avatar_url}
                            alt={member.display_name || "Member"}
                            fill
                            className="object-cover"
                            sizes="64px"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-xl font-medium text-muted-foreground">
                            {(member?.display_name || "?").charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <input
                          ref={editAvatarInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          aria-label="Upload profile image"
                          className="block w-full text-sm text-muted file:mr-2 file:rounded file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-background"
                        />
                        <p className="text-xs text-muted mt-1">JPEG, PNG, GIF or WebP. Max 2MB.</p>
                      </div>
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-1">Display name</label>
                  <input
                    type="text"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    aria-label="Display name"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                {isOwner && (
                  <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Role</label>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      aria-label="Role"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    >
                      {editRoleOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Employment type</label>
                    <select
                      value={editEmploymentType}
                      onChange={(e) => setEditEmploymentType(e.target.value as "EMPLOYEE" | "RENTER")}
                      aria-label="Employment type"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    >
                      <option value="EMPLOYEE">Employee (100% to salon)</option>
                      <option value="RENTER">Renter (split: stylist + admin fee to salon)</option>
                    </select>
                  </div>
                  </>
                )}
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
        );
      })()}
    </div>
  );
}
