"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@core/supabase/admin";
import { hashPasscode } from "@core/auth/passcode";
import { uploadTeamAvatarImage } from "@core/storage/team-avatar";
import { getCurrentUserNailSalon } from "@modules/nail/lib/shop";

async function requireSalonOwner() {
  const context = await getCurrentUserNailSalon();
  if (!context) return { error: "Unauthorized" as const, context: null };
  if (context.member.role !== "owner" && context.member.id !== "admin") {
    return { error: "Only salon owners can manage the team" as const, context: null };
  }
  return { error: null, context };
}

function getAdmin() {
  try {
    return { admin: createAdminClient(), error: null as string | null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Admin client unavailable";
    return { admin: null, error: msg };
  }
}

function revalidateTeamPaths(slug?: string) {
  revalidatePath("/nail/team");
  revalidatePath("/nail/queue");
  revalidatePath("/nail/appointments");
  revalidatePath("/nail/dashboard");
  if (slug) revalidatePath(`/nail/join/${slug}`);
}

async function uploadAvatarForMember(
  salonId: string,
  memberId: string,
  raw: Blob & { name?: string; type?: string; size?: number }
): Promise<{ error: string | null; url?: string }> {
  const { admin, error: adminError } = getAdmin();
  if (adminError || !admin) return { error: adminError ?? "Admin client unavailable" };

  const name = raw.name || "avatar.jpg";
  const ext = name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `nail-avatars/${salonId}/${memberId}.${ext}`;

  const upload = await uploadTeamAvatarImage(path, raw);
  if (upload.error || !upload.url) return { error: upload.error ?? "Upload failed" };

  const { data: updated, error: updateError } = await admin
    .from("nail_members")
    .update({ avatar_url: upload.url })
    .eq("id", memberId)
    .eq("salon_id", salonId)
    .select("avatar_url")
    .single();

  if (updateError) return { error: updateError.message };
  if (!updated?.avatar_url) return { error: "Photo saved to storage but could not update profile" };
  return { error: null, url: updated.avatar_url };
}

export async function addNailTeamMember(
  formData: FormData
): Promise<{ error?: string; memberId?: string }> {
  const { error, context } = await requireSalonOwner();
  if (error || !context) return { error: error ?? "Unauthorized" };

  const { admin, error: adminError } = getAdmin();
  if (adminError || !admin) return { error: adminError ?? "Admin client unavailable" };

  const displayName = (formData.get("display_name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const role = (formData.get("role") as string)?.trim() || "Nail Technician";
  const stationRaw = (formData.get("station_number") as string)?.trim();
  const station =
    stationRaw === "" ? null : Number.parseInt(stationRaw, 10);
  const showOnDiary = formData.get("show_on_diary") !== "false";

  if (!displayName) return { error: "Display name is required" };

  const salonId = context.salon.id;
  let memberId: string | undefined;

  if (email) {
    const normalized = email.toLowerCase();
    const { data: profile } = await admin
      .from("profiles")
      .select("id, full_name, email")
      .eq("email", normalized)
      .maybeSingle();

    if (!profile) {
      return {
        error:
          "No account found with that email. They need to sign up first, or add them without email.",
      };
    }

    const name =
      displayName ||
      (profile.full_name as string) ||
      profile.email?.split("@")[0] ||
      "Technician";

    const { data: member, error: upsertError } = await admin
      .from("nail_members")
      .upsert(
        {
          salon_id: salonId,
          user_id: profile.id,
          role,
          display_name: name,
          station_number: station != null && !Number.isNaN(station) ? station : null,
          is_active: true,
          is_accepting_walk_ins: role !== "Reception" && role !== "owner",
          show_on_diary: showOnDiary,
        },
        { onConflict: "salon_id,user_id" }
      )
      .select("id")
      .single();

    if (upsertError) return { error: upsertError.message };
    memberId = member?.id;
  } else {
    const { data: member, error: insertError } = await admin
      .from("nail_members")
      .insert({
        salon_id: salonId,
        user_id: null,
        role,
        display_name: displayName,
        station_number: station != null && !Number.isNaN(station) ? station : null,
        is_active: true,
        is_accepting_walk_ins: role !== "Reception" && role !== "owner",
        show_on_diary: showOnDiary,
      })
      .select("id")
      .single();

    if (insertError) return { error: insertError.message };
    memberId = member?.id;
  }

  const avatarRaw = formData.get("avatar");
  if (memberId && avatarRaw && typeof avatarRaw === "object" && "size" in avatarRaw) {
    const upload = await uploadAvatarForMember(
      salonId,
      memberId,
      avatarRaw as Blob & { name?: string; type?: string; size?: number }
    );
    if (upload.error) {
      revalidateTeamPaths(context.salon.slug);
      return {
        error: `Team member added but photo upload failed: ${upload.error}`,
        memberId,
      };
    }
  }

  revalidateTeamPaths(context.salon.slug);
  return { memberId };
}

export async function inviteOrAddNailTeamMember(
  salonId: string,
  data: {
    display_name: string;
    role: string;
    email?: string;
    show_on_diary?: boolean;
    station_number?: number | null;
  }
): Promise<{ error?: string; memberId?: string }> {
  const context = await getCurrentUserNailSalon();
  if (!context || context.salon.id !== salonId) return { error: "Unauthorized" };
  if (context.member.role !== "owner" && context.member.id !== "admin") {
    return { error: "Only owners can add team members" };
  }

  const fd = new FormData();
  fd.set("display_name", data.display_name);
  fd.set("role", data.role);
  if (data.email?.trim()) fd.set("email", data.email.trim());
  if (data.station_number != null && !Number.isNaN(data.station_number)) {
    fd.set("station_number", String(data.station_number));
  }
  if (data.show_on_diary === false) fd.set("show_on_diary", "false");
  return addNailTeamMember(fd);
}

export async function updateNailTeamMember(
  memberId: string,
  updates: {
    display_name?: string;
    role?: string;
    station_number?: number | null;
    is_accepting_walk_ins?: boolean;
    show_on_diary?: boolean;
    employment_type?: "EMPLOYEE" | "RENTER";
    is_active?: boolean;
  }
): Promise<{ error?: string }> {
  const { error, context } = await requireSalonOwner();
  if (error || !context) return { error: error ?? "Unauthorized" };

  const { admin, error: adminError } = getAdmin();
  if (adminError || !admin) return { error: adminError ?? "Admin client unavailable" };

  const payload: Record<string, unknown> = {};
  if (updates.display_name !== undefined) payload.display_name = updates.display_name.trim();
  if (updates.role !== undefined) payload.role = updates.role.trim() || "Nail Technician";
  if (updates.station_number !== undefined) {
    payload.station_number =
      updates.station_number != null && !Number.isNaN(updates.station_number)
        ? Number(updates.station_number)
        : null;
  }
  if (updates.is_accepting_walk_ins !== undefined) {
    payload.is_accepting_walk_ins = updates.is_accepting_walk_ins;
  }
  if (updates.show_on_diary !== undefined) payload.show_on_diary = updates.show_on_diary;
  if (updates.employment_type !== undefined) payload.employment_type = updates.employment_type;
  if (updates.is_active !== undefined) payload.is_active = updates.is_active;

  const { error: updateError } = await admin
    .from("nail_members")
    .update(payload)
    .eq("id", memberId)
    .eq("salon_id", context.salon.id);

  if (updateError) return { error: updateError.message };
  revalidateTeamPaths(context.salon.slug);
  return {};
}

export async function updateNailSalonBranding(updates: {
  show_title_on_queue?: boolean;
  company_name?: string;
}): Promise<{ error?: string }> {
  const { error, context } = await requireSalonOwner();
  if (error || !context) return { error: error ?? "Unauthorized" };

  const { admin, error: adminError } = getAdmin();
  if (adminError || !admin) return { error: adminError ?? "Admin client unavailable" };

  const { data: existing } = await admin
    .from("nail_salons")
    .select("settings")
    .eq("id", context.salon.id)
    .single();
  if (!existing) return { error: "Salon not found" };

  const current = (existing.settings as Record<string, unknown>) ?? {};
  const branding: Record<string, unknown> = {
    ...((current.branding as Record<string, unknown>) ?? {}),
    ...updates,
  };
  if (updates.company_name !== undefined) {
    branding.company_name = updates.company_name.trim();
  }

  const { error: updateError } = await admin
    .from("nail_salons")
    .update({ settings: { ...current, branding } })
    .eq("id", context.salon.id);

  if (updateError) return { error: updateError.message };
  revalidateTeamPaths(context.salon.slug);
  return {};
}

export async function updateNailSalonTeamRoles(
  salonId: string,
  roles: string[]
): Promise<{ error?: string }> {
  const context = await getCurrentUserNailSalon();
  if (!context || context.salon.id !== salonId) return { error: "Unauthorized" };
  if (context.member.role !== "owner" && context.member.id !== "admin") {
    return { error: "Unauthorized" };
  }

  const trimmed = roles.map((r) => r.trim()).filter(Boolean);
  const unique = [...new Set(trimmed)];

  const { admin, error: adminError } = getAdmin();
  if (adminError || !admin) return { error: adminError ?? "Admin client unavailable" };

  const { data: existing } = await admin
    .from("nail_salons")
    .select("settings")
    .eq("id", salonId)
    .single();
  if (!existing) return { error: "Salon not found" };

  const current = (existing.settings as Record<string, unknown>) ?? {};
  const { error: updateError } = await admin
    .from("nail_salons")
    .update({ settings: { ...current, team_roles: unique } })
    .eq("id", salonId);

  if (updateError) return { error: updateError.message };
  revalidateTeamPaths(context.salon.slug);
  return {};
}

export async function removeNailTeamMember(memberId: string): Promise<{ error?: string }> {
  const { error, context } = await requireSalonOwner();
  if (error || !context) return { error: error ?? "Unauthorized" };

  const { admin, error: adminError } = getAdmin();
  if (adminError || !admin) return { error: adminError ?? "Admin client unavailable" };

  const { data: member } = await admin
    .from("nail_members")
    .select("id, role")
    .eq("id", memberId)
    .eq("salon_id", context.salon.id)
    .single();

  if (!member) return { error: "Team member not found" };
  if (member.role === "owner") return { error: "Cannot remove the salon owner" };

  const { count: appointmentCount } = await admin
    .from("nail_appointments")
    .select("id", { count: "exact", head: true })
    .eq("technician_id", memberId);

  if ((appointmentCount ?? 0) > 0) {
    const { error: deactivateError } = await admin
      .from("nail_members")
      .update({ is_active: false, is_accepting_walk_ins: false })
      .eq("id", memberId)
      .eq("salon_id", context.salon.id);
    if (deactivateError) return { error: deactivateError.message };
    revalidateTeamPaths(context.salon.slug);
    return {};
  }

  const { error: deleteError } = await admin
    .from("nail_members")
    .delete()
    .eq("id", memberId)
    .eq("salon_id", context.salon.id);

  if (deleteError) return { error: deleteError.message };
  revalidateTeamPaths(context.salon.slug);
  return {};
}

export async function deleteNailTeamMember(
  salonId: string,
  memberId: string
): Promise<{ error?: string }> {
  const context = await getCurrentUserNailSalon();
  if (!context || context.salon.id !== salonId) return { error: "Unauthorized" };
  if (context.member.role !== "owner" && context.member.id !== "admin") {
    return { error: "Only owners can delete team members" };
  }
  return removeNailTeamMember(memberId);
}

export async function uploadNailTeamMemberAvatar(
  salonId: string,
  memberId: string,
  formData: FormData
): Promise<{ error: string | null; url?: string }> {
  const context = await getCurrentUserNailSalon();
  if (!context || context.salon.id !== salonId) return { error: "Unauthorized" };
  if (context.member.role !== "owner" && context.member.id !== "admin") {
    return { error: "Only owners can update team avatars" };
  }

  const raw = formData.get("avatar");
  if (!raw || typeof raw !== "object" || !("size" in raw)) {
    return { error: "No file provided" };
  }

  const result = await uploadAvatarForMember(
    salonId,
    memberId,
    raw as Blob & { name?: string; type?: string; size?: number }
  );
  if (!result.error) revalidateTeamPaths(context.salon.slug);
  return result;
}

export async function upsertTechnicianServiceOverride(
  salonId: string,
  technicianId: string,
  serviceId: string,
  durationMinutes: number
): Promise<{ error?: string }> {
  const context = await getCurrentUserNailSalon();
  if (!context || context.salon.id !== salonId) return { error: "Unauthorized" };

  const { admin, error: adminError } = getAdmin();
  if (adminError || !admin) return { error: adminError ?? "Admin client unavailable" };

  const duration = Math.max(1, Math.min(480, Math.round(durationMinutes)));

  const { error } = await admin.from("nail_technician_service_overrides").upsert(
    {
      technician_id: technicianId,
      service_id: serviceId,
      duration_minutes: duration,
    },
    { onConflict: "technician_id,service_id" }
  );

  if (error) return { error: error.message };
  revalidateTeamPaths(context.salon.slug);
  return {};
}

export async function deleteTechnicianServiceOverride(
  salonId: string,
  technicianId: string,
  serviceId: string
): Promise<{ error?: string }> {
  const context = await getCurrentUserNailSalon();
  if (!context || context.salon.id !== salonId) return { error: "Unauthorized" };

  const { admin, error: adminError } = getAdmin();
  if (adminError || !admin) return { error: adminError ?? "Admin client unavailable" };

  const { error } = await admin
    .from("nail_technician_service_overrides")
    .delete()
    .eq("technician_id", technicianId)
    .eq("service_id", serviceId);

  if (error) return { error: error.message };
  revalidateTeamPaths(context.salon.slug);
  return {};
}

export async function setNailMemberPasscode(
  salonId: string,
  memberId: string,
  pin: string
): Promise<{ error?: string }> {
  const context = await getCurrentUserNailSalon();
  if (!context || context.salon.id !== salonId) return { error: "Unauthorized" };
  if (context.member.role !== "owner" && context.member.id !== "admin") {
    return { error: "Only owners can set passcodes" };
  }
  if (!/^\d{4}$/.test(pin)) return { error: "Passcode must be exactly 4 digits" };

  const { admin, error: adminError } = getAdmin();
  if (adminError || !admin) return { error: adminError ?? "Admin client unavailable" };

  const { error } = await admin
    .from("nail_members")
    .update({ passcode_hash: hashPasscode(pin) })
    .eq("id", memberId)
    .eq("salon_id", salonId);

  if (error) return { error: error.message };
  revalidateTeamPaths(context.salon.slug);
  return {};
}

export async function clearNailMemberPasscode(
  salonId: string,
  memberId: string
): Promise<{ error?: string }> {
  const context = await getCurrentUserNailSalon();
  if (!context || context.salon.id !== salonId) return { error: "Unauthorized" };
  if (context.member.role !== "owner" && context.member.id !== "admin") {
    return { error: "Only owners can clear passcodes" };
  }

  const { admin, error: adminError } = getAdmin();
  if (adminError || !admin) return { error: adminError ?? "Admin client unavailable" };

  const { error } = await admin
    .from("nail_members")
    .update({ passcode_hash: null })
    .eq("id", memberId)
    .eq("salon_id", salonId);

  if (error) return { error: error.message };
  revalidateTeamPaths(context.salon.slug);
  return {};
}
