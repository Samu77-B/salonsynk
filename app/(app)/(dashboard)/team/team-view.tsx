"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { inviteOrAddTeamMember, updateTeamMember, deleteTeamMember, deleteInvite, uploadTeamMemberAvatar, updateSalonTeamRoles } from "./actions";

type Member = { id: string; user_id?: string | null; display_name: string | null; role: string; is_active: boolean; holiday_ranges?: unknown; employment_type?: string; avatar_url?: string | null; calendar_color?: string | null };
type Invite = { id: string; email: string; role: string; display_name: string | null; created_at: string };

const CALENDAR_COLORS = [
  "#3b82f6", "#22c55e", "#eab308", "#ef4444", "#a855f7",
  "#06b6d4", "#f97316", "#ec4899", "#14b8a6", "#84cc16",
  "#6366f1", "#0ea5e9",
];

const PREDEFINED_ROLES = [
  { value: "owner", label: "Owner" },
  { value: "Creative Director", label: "Creative Director" },
  { value: "Advanced Senior Stylist", label: "Advanced Senior Stylist" },
  { value: "Senior Stylist", label: "Senior Stylist" },
  { value: "Junior Stylist", label: "Junior Stylist" },
  { value: "stylist", label: "Stylist" },
] as const;

const ADD_ROLE_VALUE = "__add_role__";

export function TeamView({
  salonId,
  members,
  memberEmails = {},
  invites,
  appointmentCountByStylist,
  isOwner,
  customRoles = [],
}: {
  salonId: string;
  members: Member[];
  memberEmails?: Record<string, string>;
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
  const [rolesLoading, setRolesLoading] = useState(false);
  const [bespokeRoleInput, setBespokeRoleInput] = useState("");
  const [editBespokeRoleInput, setEditBespokeRoleInput] = useState("");
  const [calendarColor, setCalendarColor] = useState<string>("");
  const [editCalendarColor, setEditCalendarColor] = useState<string>("");
  const [localCustomRoles, setLocalCustomRoles] = useState<string[]>(customRoles);
  const editAvatarInputRef = useRef<HTMLInputElement>(null);
  const addAvatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalCustomRoles(customRoles);
  }, [customRoles]);

  const roleOptions = [
    ...PREDEFINED_ROLES,
    ...localCustomRoles.map((r) => ({ value: r, label: r })),
    { value: ADD_ROLE_VALUE, label: "(add role)" },
  ];

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await inviteOrAddTeamMember(salonId, {
      display_name: displayName,
      role,
      email: email || undefined,
      calendar_color: calendarColor || undefined,
    });
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
    setBespokeRoleInput("");
    setCalendarColor("");
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
      ...(isOwner ? { employment_type: editEmploymentType, role: editRole, calendar_color: editCalendarColor || null } : {}),
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

  async function handleReactivate(id: string) {
    setError(null);
    const result = await updateTeamMember(id, { is_active: true });
    if (result.error) setError(result.error);
  }

  async function handleDeleteMember(id: string) {
    if (!confirm("Permanently delete this team member? This cannot be undone.")) return;
    setError(null);
    const result = await deleteTeamMember(salonId, id);
    if (result.error) setError(result.error);
  }

  async function handleDeleteInvite(id: string) {
    if (!confirm("Cancel this invite?")) return;
    setError(null);
    const result = await deleteInvite(id);
    if (result.error) setError(result.error);
  }

  async function handleAddBespokeRole(fromAddModal: boolean) {
    const name = (fromAddModal ? bespokeRoleInput : editBespokeRoleInput).trim();
    if (!name) return;
    setError(null);
    setRolesLoading(true);
    const nextCustom = [...localCustomRoles, name];
    const result = await updateSalonTeamRoles(salonId, nextCustom);
    setRolesLoading(false);
    if (result.error) setError(result.error);
    else {
      setLocalCustomRoles(nextCustom);
      if (fromAddModal) {
        setRole(name);
        setBespokeRoleInput("");
      } else {
        setEditRole(name);
        setEditBespokeRoleInput("");
      }
    }
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
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{m.display_name || m.role}</p>
                    {m.calendar_color && (
                      <span
                        className="h-3 w-3 shrink-0 rounded-full border border-border"
                        style={{ backgroundColor: m.calendar_color }}
                        title="Diary colour"
                      />
                    )}
                  </div>
                  <p className="text-sm text-muted capitalize">{m.role}</p>
                  {m.user_id && memberEmails[m.user_id] && (
                    <p className="text-xs text-muted" title="Has login">Login: {memberEmails[m.user_id]}</p>
                  )}
                  {!m.user_id && (
                    <p className="text-xs text-muted">No account (display only)</p>
                  )}
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
              {isOwner && (
                <div className="flex flex-wrap gap-2">
                  {m.is_active && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditId(m.id);
                          setEditDisplayName(m.display_name ?? "");
                          setEditRole(m.role || "stylist");
                          setEditCalendarColor(m.calendar_color ?? "");
                          setEditEmploymentType((m.employment_type as "EMPLOYEE" | "RENTER") || "EMPLOYEE");
                        }}
                        className="text-sm text-accent hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeactivate(m.id)}
                        className="text-sm text-amber-500 hover:underline"
                      >
                        Deactivate
                      </button>
                    </>
                  )}
                  {!m.is_active && (
                    <button
                      type="button"
                      onClick={() => handleReactivate(m.id)}
                      className="text-sm text-green-500 hover:underline"
                    >
                      Reactivate
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteMember(m.id)}
                    className="text-sm text-red-400 hover:underline"
                  >
                    Delete
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
                {role === ADD_ROLE_VALUE && (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={bespokeRoleInput}
                      onChange={(e) => setBespokeRoleInput(e.target.value)}
                      placeholder="Enter role name"
                      aria-label="Bespoke role name"
                      className="rounded-lg border border-border bg-background px-3 py-2 text-sm flex-1 min-w-0"
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddBespokeRole(true))}
                    />
                    <button
                      type="button"
                      onClick={() => handleAddBespokeRole(true)}
                      disabled={rolesLoading || !bespokeRoleInput.trim()}
                      className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Diary colour</label>
                <p className="text-xs text-muted mb-2">Used on the calendar so you can see who is booked at a glance.</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setCalendarColor("")}
                    className={`h-8 w-8 rounded-full border-2 shrink-0 ${!calendarColor ? "border-foreground ring-2 ring-offset-2 ring-offset-background ring-accent" : "border-transparent"}`}
                    style={{ backgroundColor: "var(--muted)" }}
                    title="No colour"
                    aria-label="No colour"
                  />
                  {CALENDAR_COLORS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setCalendarColor(hex)}
                      className={`h-8 w-8 rounded-full border-2 shrink-0 ${calendarColor === hex ? "border-foreground ring-2 ring-offset-2 ring-offset-background ring-accent" : "border-transparent"}`}
                      style={{ backgroundColor: hex }}
                      title={hex}
                      aria-label={`Colour ${hex}`}
                    />
                  ))}
                </div>
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
                <button type="submit" disabled={loading || !displayName.trim() || role === ADD_ROLE_VALUE} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
                  {loading ? "Adding…" : email.trim() ? "Send invite" : "Add member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editId && (() => {
        const member = members.find((m) => m.id === editId);
        const baseEditRoleOptions = roleOptions.filter((o) => o.value !== ADD_ROLE_VALUE);
        const editRoleOptions = member && !baseEditRoleOptions.some((o) => o.value === member.role)
          ? [...baseEditRoleOptions, { value: member.role, label: member.role }, { value: ADD_ROLE_VALUE, label: "(add role)" }]
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
                    <label className="block text-sm font-medium mb-1">Diary colour</label>
                    <p className="text-xs text-muted mb-2">Used on the calendar so you can see who is booked at a glance.</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setEditCalendarColor("")}
                        className={`h-8 w-8 rounded-full border-2 shrink-0 ${!editCalendarColor ? "border-foreground ring-2 ring-offset-2 ring-offset-background ring-accent" : "border-transparent"}`}
                        style={{ backgroundColor: "var(--muted)" }}
                        title="No colour"
                        aria-label="No colour"
                      />
                      {CALENDAR_COLORS.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => setEditCalendarColor(hex)}
                          className={`h-8 w-8 rounded-full border-2 shrink-0 ${editCalendarColor === hex ? "border-foreground ring-2 ring-offset-2 ring-offset-background ring-accent" : "border-transparent"}`}
                          style={{ backgroundColor: hex }}
                          title={hex}
                          aria-label={`Colour ${hex}`}
                        />
                      ))}
                    </div>
                  </div>
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
                    {editRole === ADD_ROLE_VALUE && (
                      <div className="mt-2 flex gap-2">
                        <input
                          type="text"
                          value={editBespokeRoleInput}
                          onChange={(e) => setEditBespokeRoleInput(e.target.value)}
                          placeholder="Enter role name"
                          aria-label="Bespoke role name"
                          className="rounded-lg border border-border bg-background px-3 py-2 text-sm flex-1 min-w-0"
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddBespokeRole(false))}
                        />
                        <button
                          type="button"
                          onClick={() => handleAddBespokeRole(false)}
                          disabled={rolesLoading || !editBespokeRoleInput.trim()}
                          className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
                        >
                          Add
                        </button>
                      </div>
                    )}
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
                  <button type="submit" disabled={loading || editRole === ADD_ROLE_VALUE} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
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
