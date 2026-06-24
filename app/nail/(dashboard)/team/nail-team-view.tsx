"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import {
  inviteOrAddNailTeamMember,
  updateNailTeamMember,
  deleteNailTeamMember,
  uploadNailTeamMemberAvatar,
  updateNailSalonTeamRoles,
  upsertTechnicianServiceOverride,
  deleteTechnicianServiceOverride,
  setNailMemberPasscode,
  clearNailMemberPasscode,
} from "@modules/nail/actions/team";
import { formatDurationMinutes } from "@/lib/format-duration";

export type NailMember = {
  id: string;
  user_id?: string | null;
  display_name: string | null;
  role: string;
  is_active: boolean;
  employment_type?: string;
  avatar_url?: string | null;
  has_passcode?: boolean;
  show_on_diary?: boolean | null;
  station_number?: number | null;
  is_accepting_walk_ins?: boolean;
};

type SalonService = { id: string; name: string; duration_minutes: number };

const PREDEFINED_ROLES = [
  { value: "owner", label: "Owner" },
  { value: "Senior Nail Technician", label: "Senior Nail Technician" },
  { value: "Nail Technician", label: "Nail Technician" },
  { value: "Reception", label: "Reception" },
] as const;

const ADD_ROLE_VALUE = "__add_role__";

export function NailTeamView({
  salonId,
  members,
  memberEmails = {},
  appointmentCountByTechnician,
  isOwner,
  customRoles = [],
  salonServices = [],
  overridesByMember = {},
  joinSlug,
}: {
  salonId: string;
  members: NailMember[];
  memberEmails?: Record<string, string>;
  appointmentCountByTechnician: Record<string, number>;
  isOwner: boolean;
  customRoles?: string[];
  salonServices?: SalonService[];
  overridesByMember?: Record<string, Record<string, number>>;
  joinSlug: string;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<string>("Nail Technician");
  const [email, setEmail] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editRole, setEditRole] = useState<string>("Nail Technician");
  const [editEmploymentType, setEditEmploymentType] = useState<"EMPLOYEE" | "RENTER">("EMPLOYEE");
  const [editShowOnDiary, setEditShowOnDiary] = useState(true);
  const [editAcceptingWalkIns, setEditAcceptingWalkIns] = useState(true);
  const [editStationNumber, setEditStationNumber] = useState("");
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

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await inviteOrAddNailTeamMember(salonId, {
      display_name: displayName,
      role,
      email: email || undefined,
      show_on_diary: role !== "Reception",
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
      const uploadResult = await uploadNailTeamMemberAvatar(salonId, result.memberId, formData);
      if (uploadResult.error) setError(uploadResult.error);
    }
    setLoading(false);
    setAddOpen(false);
    setDisplayName("");
    setEmail("");
    setRole("Nail Technician");
    setBespokeRoleInput("");
    if (addAvatarInputRef.current) addAvatarInputRef.current.value = "";
    window.location.reload();
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
      const uploadResult = await uploadNailTeamMemberAvatar(salonId, editId, formData);
      if (uploadResult.error) {
        setError(uploadResult.error);
        setLoading(false);
        return;
      }
    }
    const station =
      editStationNumber.trim() === "" ? null : Number.parseInt(editStationNumber, 10);
    const result = await updateNailTeamMember(editId, {
      display_name: editDisplayName,
      ...(isOwner
        ? {
            employment_type: editEmploymentType,
            role: editRole,
            show_on_diary: editShowOnDiary,
            is_accepting_walk_ins: editAcceptingWalkIns,
            station_number: station != null && !Number.isNaN(station) ? station : null,
          }
        : {}),
    });
    setLoading(false);
    if (result.error) setError(result.error);
    else {
      setEditId(null);
      if (editAvatarInputRef.current) editAvatarInputRef.current.value = "";
      window.location.reload();
    }
  }

  async function handleDeactivate(id: string) {
    if (!confirm("Deactivate this team member?")) return;
    setError(null);
    const result = await updateNailTeamMember(id, { is_active: false, is_accepting_walk_ins: false });
    if (result.error) setError(result.error);
    else window.location.reload();
  }

  async function handleReactivate(id: string) {
    setError(null);
    const result = await updateNailTeamMember(id, { is_active: true });
    if (result.error) setError(result.error);
    else window.location.reload();
  }

  async function handleDeleteMember(id: string) {
    if (!confirm("Permanently delete this team member? This cannot be undone.")) return;
    setError(null);
    const result = await deleteNailTeamMember(salonId, id);
    if (result.error) setError(result.error);
    else window.location.reload();
  }

  async function handleAddBespokeRole(fromAddModal: boolean) {
    const name = (fromAddModal ? bespokeRoleInput : editBespokeRoleInput).trim();
    if (!name) return;
    setError(null);
    setRolesLoading(true);
    const nextCustom = [...localCustomRoles, name];
    const result = await updateNailSalonTeamRoles(salonId, nextCustom);
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

  async function handleWalkInToggle(member: NailMember, checked: boolean) {
    setError(null);
    const result = await updateNailTeamMember(member.id, { is_accepting_walk_ins: checked });
    if (result.error) setError(result.error);
    else window.location.reload();
  }

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted">
            Public queue:{" "}
            <a
              href={`/nail/join/${joinSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              /nail/join/{joinSlug}
            </a>
          </p>
        </div>
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
                  <p className="font-medium truncate">{m.display_name || m.role}</p>
                  <p className="text-sm text-muted capitalize">{m.role}</p>
                  {m.show_on_diary === false ? (
                    <p className="text-xs text-muted-foreground">Hidden from diary column</p>
                  ) : null}
                  {m.is_accepting_walk_ins === false ? (
                    <p className="text-xs text-amber-400">Hidden from walk-in queue picker</p>
                  ) : null}
                  {m.station_number != null && (
                    <p className="text-xs text-muted">Station {m.station_number}</p>
                  )}
                  {m.user_id && memberEmails[m.user_id] && (
                    <p className="text-xs text-muted" title="Has login">
                      Login: {memberEmails[m.user_id]}
                    </p>
                  )}
                  {!m.user_id && (
                    <p className="text-xs text-muted">No account (display only)</p>
                  )}
                  {m.role !== "owner" && m.role !== "Reception" && (
                    <p className="text-xs text-muted">
                      {(m.employment_type as string) === "RENTER" ? "Renter" : "Employee"}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted">
                    Appointments (last 30 days): {appointmentCountByTechnician[m.id] ?? 0}
                  </p>
                  {m.is_active && salonServices.length > 0 && m.show_on_diary !== false && (
                    <button
                      type="button"
                      onClick={() => setTimingsId(m.id)}
                      className="mt-1 text-xs text-accent hover:underline"
                    >
                      Service timings
                      {localOverrides[m.id] && Object.keys(localOverrides[m.id]).length > 0 && (
                        <span className="ml-1 text-muted">
                          ({Object.keys(localOverrides[m.id]).length} custom)
                        </span>
                      )}
                    </button>
                  )}
                  {isOwner && m.is_active && m.role !== "owner" && (
                    <label className="mt-2 flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={m.is_accepting_walk_ins !== false}
                        onChange={(e) => void handleWalkInToggle(m, e.target.checked)}
                      />
                      Show on walk-in queue page
                    </label>
                  )}
                  {isOwner && m.is_active && (
                    <span className="text-xs text-muted mt-0.5 block">
                      PIN:{" "}
                      {m.has_passcode ? (
                        <>
                          <span className="text-green-400">set</span>
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
                              const result = await clearNailMemberPasscode(salonId, m.id);
                              if (result.error) setError(result.error);
                              else window.location.reload();
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
              </div>
              {isOwner && m.role !== "owner" && (
                <div className="flex flex-wrap gap-2">
                  {m.is_active && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditId(m.id);
                          setEditDisplayName(m.display_name ?? "");
                          setEditRole(m.role || "Nail Technician");
                          setEditEmploymentType((m.employment_type as "EMPLOYEE" | "RENTER") || "EMPLOYEE");
                          setEditShowOnDiary(m.show_on_diary !== false);
                          setEditAcceptingWalkIns(m.is_accepting_walk_ins !== false);
                          setEditStationNumber(
                            m.station_number != null ? String(m.station_number) : ""
                          );
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

      {addOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setAddOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-border bg-background p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-4">Add team member</h2>
            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Display name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Jane Smith"
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
                  placeholder="Link to existing account"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <p className="text-xs text-muted mt-1">
                  Leave blank to add without an account until they sign up.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  {roleOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {role === ADD_ROLE_VALUE && (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={bespokeRoleInput}
                      onChange={(e) => setBespokeRoleInput(e.target.value)}
                      placeholder="Enter role name"
                      className="rounded-lg border border-border bg-background px-3 py-2 text-sm flex-1 min-w-0"
                      onKeyDown={(e) =>
                        e.key === "Enter" && (e.preventDefault(), handleAddBespokeRole(true))
                      }
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
                    className="block w-full text-sm text-muted file:mr-2 file:rounded file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-background"
                  />
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !displayName.trim() || role === ADD_ROLE_VALUE}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
                >
                  {loading ? "Adding…" : "Add member"}
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
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setTimingsId(null)}
          >
            <div
              className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-lg border border-border bg-background p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold mb-1">Service timings</h2>
              <p className="text-sm text-muted mb-4">
                Custom durations for {member?.display_name || "this technician"}. Leave blank to
                use the default.
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
                        <p className="text-xs text-muted">
                          Default: {formatDurationMinutes(svc.duration_minutes)}
                        </p>
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
                                next[timingsId] = {
                                  ...next[timingsId],
                                  [svc.id]: Number(val) || svc.duration_minutes,
                                };
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
                <button
                  type="button"
                  onClick={() => setTimingsId(null)}
                  className="rounded-lg border border-border px-4 py-2 text-sm"
                >
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
                    const allServiceIds = new Set([
                      ...Object.keys(currentOverrides),
                      ...Object.keys(originalOverrides),
                    ]);
                    for (const serviceId of allServiceIds) {
                      const newVal = currentOverrides[serviceId];
                      const oldVal = originalOverrides[serviceId];
                      if (newVal !== undefined && newVal !== oldVal) {
                        const result = await upsertTechnicianServiceOverride(
                          salonId,
                          timingsId,
                          serviceId,
                          newVal
                        );
                        if (result.error) {
                          setError(result.error);
                          setTimingsSaving(false);
                          return;
                        }
                      } else if (newVal === undefined && oldVal !== undefined) {
                        const result = await deleteTechnicianServiceOverride(
                          salonId,
                          timingsId,
                          serviceId
                        );
                        if (result.error) {
                          setError(result.error);
                          setTimingsSaving(false);
                          return;
                        }
                      }
                    }
                    setTimingsSaving(false);
                    setTimingsId(null);
                    window.location.reload();
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
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setPasscodeId(null)}
          >
            <div
              className="w-full max-w-xs rounded-lg border border-border bg-background p-6 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold mb-1">
                {pinMember?.has_passcode ? "Change" : "Set"} PIN
              </h2>
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
                        const nextInput = e.target.parentElement?.children[i + 1] as
                          | HTMLInputElement
                          | undefined;
                        nextInput?.focus();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && !pinDigits[i] && i > 0) {
                        const prev = e.currentTarget.parentElement?.children[i - 1] as
                          | HTMLInputElement
                          | undefined;
                        prev?.focus();
                      }
                    }}
                  />
                ))}
              </div>
              <div className="flex gap-2 justify-center">
                <button
                  type="button"
                  onClick={() => setPasscodeId(null)}
                  className="rounded-lg border border-border px-4 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!pinComplete || pinSaving}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
                  onClick={async () => {
                    setPinSaving(true);
                    setError(null);
                    const pin = pinDigits.join("");
                    const result = await setNailMemberPasscode(salonId, passcodeId, pin);
                    setPinSaving(false);
                    if (result.error) setError(result.error);
                    else {
                      setPasscodeId(null);
                      window.location.reload();
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
        const editRoleOptions =
          member && !baseEditRoleOptions.some((o) => o.value === member.role)
            ? [
                ...baseEditRoleOptions,
                { value: member.role, label: member.role },
                { value: ADD_ROLE_VALUE, label: "(add role)" },
              ]
            : roleOptions;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setEditId(null)}
          >
            <div
              className="w-full max-w-md rounded-lg border border-border bg-background p-6"
              onClick={(e) => e.stopPropagation()}
            >
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
                      <input
                        ref={editAvatarInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        className="block w-full text-sm text-muted file:mr-2 file:rounded file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-background"
                      />
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-1">Display name</label>
                  <input
                    type="text"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
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
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      >
                        {editRoleOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      {editRole === ADD_ROLE_VALUE && (
                        <div className="mt-2 flex gap-2">
                          <input
                            type="text"
                            value={editBespokeRoleInput}
                            onChange={(e) => setEditBespokeRoleInput(e.target.value)}
                            placeholder="Enter role name"
                            className="rounded-lg border border-border bg-background px-3 py-2 text-sm flex-1 min-w-0"
                            onKeyDown={(e) =>
                              e.key === "Enter" && (e.preventDefault(), handleAddBespokeRole(false))
                            }
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
                      <label className="block text-sm font-medium mb-1">Station number</label>
                      <input
                        type="number"
                        min={1}
                        value={editStationNumber}
                        onChange={(e) => setEditStationNumber(e.target.value)}
                        placeholder="Optional"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Employment type</label>
                      <select
                        value={editEmploymentType}
                        onChange={(e) =>
                          setEditEmploymentType(e.target.value as "EMPLOYEE" | "RENTER")
                        }
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      >
                        <option value="EMPLOYEE">Employee</option>
                        <option value="RENTER">Renter</option>
                      </select>
                    </div>
                    <label className="flex cursor-pointer items-start gap-2 text-sm leading-snug">
                      <input
                        type="checkbox"
                        className="mt-1 rounded border-border"
                        checked={editShowOnDiary}
                        onChange={(e) => setEditShowOnDiary(e.target.checked)}
                      />
                      <span>Show as a technician column on the diary</span>
                    </label>
                    <p className="text-xs text-muted -mt-1 pl-7">
                      Turn off for reception or shared logins who don&apos;t take appointments as a
                      column.
                    </p>
                    <label className="flex cursor-pointer items-start gap-2 text-sm leading-snug">
                      <input
                        type="checkbox"
                        className="mt-1 rounded border-border"
                        checked={editAcceptingWalkIns}
                        onChange={(e) => setEditAcceptingWalkIns(e.target.checked)}
                      />
                      <span>Show on the public walk-in queue page</span>
                    </label>
                  </>
                )}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditId(null)}
                    className="rounded-lg border border-border px-4 py-2 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || editRole === ADD_ROLE_VALUE}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
                  >
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
