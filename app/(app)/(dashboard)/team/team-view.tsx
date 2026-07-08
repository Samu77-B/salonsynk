"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { inviteOrAddTeamMember, updateTeamMember, deleteTeamMember, deleteInvite, uploadTeamMemberAvatar, updateSalonTeamRoles, upsertStylistServiceOverride, deleteStylistServiceOverride, setMemberPasscode, clearMemberPasscode } from "./actions";
import { StaffOnboardingWizard } from "./staff-onboarding-wizard";
import { formatDurationMinutes } from "@/lib/format-duration";
import {
  EMPLOYMENT_TYPE_OPTIONS,
  employmentTypeHint,
  employmentTypeShortLabel,
} from "@/config/employment-types";
import { DashboardPageHeader } from "@/components/dashboard/page-layout";
import { dashboardBtnPrimaryClass, dashboardCardClass, dashboardFlowClass, dashboardStaggerClass } from "@/components/dashboard/ui";

export type Member = {
  id: string;
  user_id?: string | null;
  display_name: string | null;
  role: string;
  is_active: boolean;
  holiday_ranges?: unknown;
  employment_type?: string;
  avatar_url?: string | null;
  has_passcode?: boolean;
  /** false = reception / login-only; omit from diary and bookable stylist lists */
  show_on_diary?: boolean | null;
  onboarding_completed_at?: string | null;
};
type Invite = { id: string; email: string; role: string; display_name: string | null; created_at: string };
type SalonService = { id: string; name: string; duration_minutes: number };

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
  salonServices = [],
  overridesByMember = {},
}: {
  salonId: string;
  members: Member[];
  memberEmails?: Record<string, string>;
  invites: Invite[];
  appointmentCountByStylist: Record<string, number>;
  isOwner: boolean;
  customRoles?: string[];
  salonServices?: SalonService[];
  overridesByMember?: Record<string, Record<string, number>>;
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
  const [localCustomRoles, setLocalCustomRoles] = useState<string[]>(customRoles);
  const [timingsId, setTimingsId] = useState<string | null>(null);
  const [passcodeId, setPasscodeId] = useState<string | null>(null);
  const [pinDigits, setPinDigits] = useState(["", "", "", ""]);
  const [pinSaving, setPinSaving] = useState(false);
  const [editShowOnDiary, setEditShowOnDiary] = useState(true);
  const [localOverrides, setLocalOverrides] = useState<Record<string, Record<string, number>>>(overridesByMember);
  const [timingsSaving, setTimingsSaving] = useState(false);
  const editAvatarInputRef = useRef<HTMLInputElement>(null);
  const addAvatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalCustomRoles(customRoles);
  }, [customRoles]);

  useEffect(() => {
    setLocalOverrides(overridesByMember);
  }, [overridesByMember]);

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
      ...(isOwner ? { employment_type: editEmploymentType, role: editRole, show_on_diary: editShowOnDiary } : {}),
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

  const pendingOnboarding = members.filter((m) => m.is_active && !m.onboarding_completed_at);

  return (
    <div className={`${dashboardFlowClass} space-y-6 min-w-0`}>
      <DashboardPageHeader
        title="Team"
        description="Stylists and staff who appear on your diary and booking page."
        actions={
          isOwner ? (
            <button type="button" onClick={() => setAddOpen(true)} className={dashboardBtnPrimaryClass}>
              Add team member
            </button>
          ) : undefined
        }
      />

      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

      {isOwner && pendingOnboarding.length > 0 && (
        <div className="space-y-3">
          {pendingOnboarding.slice(0, 2).map((m) => (
            <StaffOnboardingWizard
              key={m.id}
              salonId={salonId}
              member={m}
              onComplete={() => window.location.reload()}
            />
          ))}
        </div>
      )}

      <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${dashboardStaggerClass}`}>
        {members.map((m) => (
          <div
            key={m.id}
            className={`${dashboardCardClass} flex flex-col gap-3 ${!m.is_active ? "opacity-60" : ""}`}
          >
            <div className="flex items-start justify-between gap-3 min-w-0">
              <div className="flex gap-3 min-w-0 flex-1">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-muted">
                  {m.avatar_url ? (
                    <Image
                      src={m.avatar_url}
                      alt={m.display_name || "Team member"}
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-lg font-medium text-muted-foreground">
                      {(m.display_name || m.role).charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 pt-0.5">
                  <p className="font-semibold truncate">{m.display_name || m.role}</p>
                  <p className="text-sm text-muted capitalize">{m.role}</p>
                </div>
              </div>
              {isOwner && (
                <div className="flex shrink-0 flex-wrap justify-end gap-x-2 gap-y-1">
                  {m.is_active && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditId(m.id);
                          setEditDisplayName(m.display_name ?? "");
                          setEditRole(m.role || "stylist");
                          setEditEmploymentType((m.employment_type as "EMPLOYEE" | "RENTER") || "EMPLOYEE");
                          setEditShowOnDiary(m.show_on_diary !== false);
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

            <div className="space-y-0.5 text-sm text-muted">
              {m.show_on_diary === false ? (
                <p>Hidden from diary &amp; online booking as a stylist</p>
              ) : null}
              {m.user_id && memberEmails[m.user_id] && (
                <p title="Has login">Login: {memberEmails[m.user_id]}</p>
              )}
              {!m.user_id && <p>No account (display only)</p>}
              {m.role === "stylist" && <p>{employmentTypeShortLabel(m.employment_type)}</p>}
              <p>Appointments (last 30 days): {appointmentCountByStylist[m.id] ?? 0}</p>
            </div>

            {m.is_active && (salonServices.length > 0 || isOwner) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                {salonServices.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setTimingsId(m.id)}
                    className="text-accent hover:underline"
                  >
                    Service timings
                    {localOverrides[m.id] && Object.keys(localOverrides[m.id]).length > 0 && (
                      <span className="ml-1 text-muted">({Object.keys(localOverrides[m.id]).length} custom)</span>
                    )}
                  </button>
                )}
                {isOwner && (
                  <span className="text-muted">
                    PIN:{" "}
                    {m.has_passcode ? (
                      <>
                        <span className="text-green-500">set</span>
                        {" · "}
                        <button
                          type="button"
                          onClick={() => {
                            setPasscodeId(m.id);
                            setPinDigits(["", "", "", ""]);
                          }}
                          className="text-accent hover:underline"
                        >
                          change
                        </button>
                        {" · "}
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm("Remove this member's PIN?")) return;
                            setError(null);
                            const result = await clearMemberPasscode(salonId, m.id);
                            if (result.error) setError(result.error);
                          }}
                          className="text-red-400 hover:underline"
                        >
                          remove
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setPasscodeId(m.id);
                          setPinDigits(["", "", "", ""]);
                        }}
                        className="text-accent hover:underline"
                      >
                        set PIN
                      </button>
                    )}
                  </span>
                )}
              </div>
            )}
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

      {timingsId && (() => {
        const member = members.find((m) => m.id === timingsId);
        const memberOverrides = localOverrides[timingsId] ?? {};
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setTimingsId(null)}>
            <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-lg border border-border bg-background p-6" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-1">Service timings</h2>
              <p className="text-sm text-muted mb-4">
                Custom durations for {member?.display_name || "this stylist"}. Leave blank to use the default.
              </p>
              {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
              <div className="space-y-3">
                {salonServices.map((svc) => {
                  const override = memberOverrides[svc.id];
                  const hasOverride = override !== undefined;
                  return (
                    <div key={svc.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{svc.name}</p>
                        <p className="text-xs text-muted">Default: {formatDurationMinutes(svc.duration_minutes)}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="number"
                          min={1}
                          max={480}
                          placeholder={String(svc.duration_minutes)}
                          value={hasOverride ? override : ""}
                          onChange={(e) => {
                            const val = e.target.value.trim();
                            setLocalOverrides((prev) => {
                              const next = { ...prev };
                              if (!next[timingsId]) next[timingsId] = {};
                              if (val === "") {
                                const copy = { ...next[timingsId] };
                                delete copy[svc.id];
                                next[timingsId] = copy;
                              } else {
                                next[timingsId] = { ...next[timingsId], [svc.id]: Number(val) || svc.duration_minutes };
                              }
                              return next;
                            });
                          }}
                          className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-center"
                          aria-label={`Custom duration for ${svc.name}`}
                        />
                        <span className="text-xs text-muted">min</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 pt-4">
                <button type="button" onClick={() => setTimingsId(null)} className="rounded-lg border border-border px-4 py-2 text-sm">
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={timingsSaving}
                  onClick={async () => {
                    setTimingsSaving(true);
                    setError(null);
                    const currentOverrides = localOverrides[timingsId] ?? {};
                    const originalOverrides = overridesByMember[timingsId] ?? {};
                    const allServiceIds = new Set([...Object.keys(currentOverrides), ...Object.keys(originalOverrides)]);
                    for (const serviceId of allServiceIds) {
                      const newVal = currentOverrides[serviceId];
                      const oldVal = originalOverrides[serviceId];
                      if (newVal !== undefined && newVal !== oldVal) {
                        const result = await upsertStylistServiceOverride(salonId, timingsId, serviceId, newVal);
                        if (result.error) { setError(result.error); setTimingsSaving(false); return; }
                      } else if (newVal === undefined && oldVal !== undefined) {
                        const result = await deleteStylistServiceOverride(salonId, timingsId, serviceId);
                        if (result.error) { setError(result.error); setTimingsSaving(false); return; }
                      }
                    }
                    setTimingsSaving(false);
                    setTimingsId(null);
                  }}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
                >
                  {timingsSaving ? "Saving…" : "Save timings"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {passcodeId && (() => {
        const pinMember = members.find((m) => m.id === passcodeId);
        const pinComplete = pinDigits.every((d) => d !== "");
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPasscodeId(null)}>
            <div className="w-full max-w-xs rounded-lg border border-border bg-background p-6 text-center" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-1">{pinMember?.has_passcode ? "Change" : "Set"} PIN</h2>
              <p className="text-sm text-muted mb-4">
                Enter a 4-digit PIN for {pinMember?.display_name || "this member"}
              </p>
              <div className="flex justify-center gap-3 mb-4">
                {pinDigits.map((d, i) => (
                  <input
                    key={i}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    autoFocus={i === 0}
                    aria-label={`PIN digit ${i + 1}`}
                    className="w-12 h-14 text-center text-2xl rounded-lg border border-border bg-background focus:ring-2 focus:ring-accent outline-none"
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 1);
                      const next = [...pinDigits];
                      next[i] = val;
                      setPinDigits(next);
                      if (val && i < 3) {
                        const nextInput = e.target.parentElement?.children[i + 1] as HTMLInputElement | undefined;
                        nextInput?.focus();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && !pinDigits[i] && i > 0) {
                        const prev = e.currentTarget.parentElement?.children[i - 1] as HTMLInputElement | undefined;
                        prev?.focus();
                      }
                    }}
                  />
                ))}
              </div>
              <div className="flex gap-2 justify-center">
                <button type="button" onClick={() => setPasscodeId(null)} className="rounded-lg border border-border px-4 py-2 text-sm">Cancel</button>
                <button
                  type="button"
                  disabled={!pinComplete || pinSaving}
                  className="rounded-lg bg-accent text-white px-4 py-2 text-sm disabled:opacity-50"
                  onClick={async () => {
                    setPinSaving(true);
                    setError(null);
                    const pin = pinDigits.join("");
                    const result = await setMemberPasscode(salonId, passcodeId, pin);
                    setPinSaving(false);
                    if (result.error) {
                      setError(result.error);
                    } else {
                      setPasscodeId(null);
                    }
                  }}
                >
                  {pinSaving ? "Saving…" : "Save PIN"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
                      <option value="EMPLOYEE">{EMPLOYMENT_TYPE_OPTIONS.EMPLOYEE.selectLabel}</option>
                      <option value="RENTER">{EMPLOYMENT_TYPE_OPTIONS.RENTER.selectLabel}</option>
                    </select>
                    <p className="text-xs text-muted mt-1">{employmentTypeHint(editEmploymentType)}</p>
                  </div>
                  <label className="flex cursor-pointer items-start gap-2 text-sm leading-snug">
                    <input
                      type="checkbox"
                      className="mt-1 rounded border-border"
                      checked={editShowOnDiary}
                      onChange={(e) => setEditShowOnDiary(e.target.checked)}
                    />
                    <span>Show as a stylist column on the diary</span>
                  </label>
                  <p className="text-xs text-muted -mt-1 pl-7">
                    Turn off for reception or shared logins who don&apos;t take appointments as a column.
                  </p>
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
