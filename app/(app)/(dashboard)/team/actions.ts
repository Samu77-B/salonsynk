"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthCallbackUrl, normalizeAuthActionLink } from "@core/auth/auth-redirect";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { revalidatePath } from "next/cache";
import { hashPasscode } from "@/lib/passcode";
import { sendOwnerInviteLink } from "@/lib/email";

const AVATAR_BUCKET = "team-avatars";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

function getAuthActionLink(d: unknown): string | null {
  if (!d || typeof d !== "object") return null;
  const o = d as Record<string, unknown>;
  const direct = o.action_link;
  if (typeof direct === "string") return normalizeAuthActionLink(direct);
  const props = o.properties as Record<string, unknown> | undefined;
  const fromProps = props?.action_link;
  if (typeof fromProps === "string") return normalizeAuthActionLink(fromProps);
  const user = o.user as Record<string, unknown> | undefined;
  const fromUser = user?.action_link;
  if (typeof fromUser === "string") return normalizeAuthActionLink(fromUser);
  return null;
}

export async function inviteOrAddTeamMember(
  salonId: string,
  data: { display_name: string; role: string; email?: string; calendar_color?: string | null }
) {
  const supabase = await createClient();
  const context = await getCurrentUserSalon();
  if (!context || context.salon.id !== salonId) return { error: "Unauthorized" };
  if (context.member.role !== "owner") return { error: "Only owners can add team members" };

  if (data.email?.trim()) {
    const trimmedEmail = data.email.trim().toLowerCase();
    const token = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
    const { error } = await supabase.from("salon_invites").insert({
      salon_id: salonId,
      email: trimmedEmail,
      role: data.role,
      display_name: data.display_name.trim() || null,
      token,
    });
    if (error) {
      if (error.code === "23505") return { error: "An invite for this email already exists" };
      return { error: error.message };
    }

    try {
      const admin = createAdminClient();
      const redirectTo = getAuthCallbackUrl("salon");
      const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
        type: "invite",
        email: trimmedEmail,
        options: {
          data: { full_name: data.display_name.trim() || undefined },
          redirectTo,
        },
      });
      if (!linkError) {
        const actionLink = getAuthActionLink(linkData);
        if (actionLink) {
          const emailResult = await sendOwnerInviteLink(
            trimmedEmail,
            actionLink,
            context.salon.name
          );
          if (emailResult.error) {
            return { error: `Invite saved but email failed: ${emailResult.error}` };
          }
        }
      }
    } catch {
      /* invite row exists; email is best-effort */
    }

    revalidatePath("/team");
    return { error: null };
  }

  // Add team member without email (display-only until they sign up and get linked)
  const displayName = data.display_name?.trim() || null;
  if (!displayName) return { error: "Display name is required" };
  const row: Record<string, unknown> = {
    salon_id: salonId,
    user_id: null,
    role: data.role,
    display_name: displayName,
  };
  if (data.calendar_color !== undefined) row.calendar_color = data.calendar_color?.trim() || null;
  // Use admin client to bypass RLS insert restrictions for placeholder members without user_id
  const admin = createAdminClient();
  const { data: inserted, error } = await admin
    .from("salon_members")
    .insert(row)
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/team");
  return { error: null, memberId: inserted?.id };
}

export async function updateTeamMember(
  id: string,
  updates: {
    display_name?: string;
    role?: string;
    holiday_ranges?: string[];
    is_active?: boolean;
    employment_type?: "EMPLOYEE" | "RENTER";
    avatar_url?: string | null;
    calendar_color?: string | null;
    show_on_diary?: boolean;
  }
) {
  const supabase = await createClient();
  const context = await getCurrentUserSalon();
  if (!context) return { error: "Unauthorized" };
  if (updates.employment_type !== undefined && context.member.role !== "owner") return { error: "Only owners can set employment type" };
  if (updates.role !== undefined && context.member.role !== "owner") return { error: "Only owners can change roles" };
  if (updates.show_on_diary !== undefined && context.member.role !== "owner") return { error: "Only owners can change diary visibility" };

  const payload: Record<string, unknown> = {};
  if (updates.display_name !== undefined) payload.display_name = updates.display_name;
  if (updates.role !== undefined) payload.role = updates.role.trim() || "stylist";
  if (updates.is_active !== undefined) payload.is_active = updates.is_active;
  if (updates.employment_type !== undefined) payload.employment_type = updates.employment_type;
  if (updates.avatar_url !== undefined) payload.avatar_url = updates.avatar_url;
  if (updates.calendar_color !== undefined) payload.calendar_color = updates.calendar_color?.trim() || null;
  if (updates.show_on_diary !== undefined) payload.show_on_diary = updates.show_on_diary;
  if (updates.holiday_ranges !== undefined) {
    payload.holiday_ranges = updates.holiday_ranges;
  }

  const { error } = await supabase
    .from("salon_members")
    .update(payload)
    .eq("id", id)
    .eq("salon_id", context.salon.id);

  if (error) return { error: error.message };
  revalidatePath("/team");
  revalidatePath("/dashboard");
  revalidatePath("/checkout");
  return { error: null };
}

export async function getSalonTeamRoles(salonId: string): Promise<{ error: string | null; roles?: string[] }> {
  const context = await getCurrentUserSalon();
  if (!context || context.salon.id !== salonId) return { error: "Unauthorized" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("salons").select("settings").eq("id", salonId).single();
  if (error) return { error: error.message };
  const settings = (data?.settings as Record<string, unknown>) ?? {};
  const roles = (settings.team_roles as string[]) ?? [];
  return { error: null, roles };
}

export async function updateSalonTeamRoles(salonId: string, roles: string[]) {
  const context = await getCurrentUserSalon();
  if (!context || context.salon.id !== salonId || context.member.role !== "owner") return { error: "Unauthorized" };
  const trimmed = roles.map((r) => r.trim()).filter(Boolean);
  const unique = [...new Set(trimmed)];
  const supabase = await createClient();
  const { data: existing } = await supabase.from("salons").select("settings").eq("id", salonId).single();
  if (!existing) return { error: "Salon not found" };
  const current = (existing.settings as Record<string, unknown>) ?? {};
  const { error } = await supabase
    .from("salons")
    .update({ settings: { ...current, team_roles: unique } })
    .eq("id", salonId);
  if (error) return { error: error.message };
  revalidatePath("/team");
  return { error: null };
}

export async function deleteTeamMember(salonId: string, memberId: string) {
  const context = await getCurrentUserSalon();
  if (!context || context.salon.id !== salonId) return { error: "Unauthorized" };
  if (context.member.role !== "owner") return { error: "Only owners can delete team members" };

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("salon_members")
    .select("id, role")
    .eq("id", memberId)
    .eq("salon_id", salonId)
    .single();
  if (!member) return { error: "Member not found" };

  if (member.role === "owner") {
    const { count } = await supabase
      .from("salon_members")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salonId)
      .eq("role", "owner");
    if ((count ?? 0) <= 1) return { error: "Cannot delete the last owner" };
  }

  const { count: appointmentCount } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("stylist_id", memberId);
  if ((appointmentCount ?? 0) > 0) {
    return { error: "Cannot delete: this member has appointments. Deactivate instead." };
  }

  const { error } = await supabase
    .from("salon_members")
    .delete()
    .eq("id", memberId)
    .eq("salon_id", salonId);

  if (error) return { error: error.message };
  revalidatePath("/team");
  return { error: null };
}

export async function deleteInvite(inviteId: string) {
  const supabase = await createClient();
  const context = await getCurrentUserSalon();
  if (!context || context.member.role !== "owner") return { error: "Unauthorized" };

  const { error } = await supabase
    .from("salon_invites")
    .delete()
    .eq("id", inviteId);

  if (error) return { error: error.message };
  revalidatePath("/team");
  return { error: null };
}

export async function getStylistServiceOverrides(
  salonId: string,
  stylistId: string
): Promise<{ error: string | null; overrides?: { service_id: string; custom_duration_minutes: number }[] }> {
  const context = await getCurrentUserSalon();
  if (!context || context.salon.id !== salonId) return { error: "Unauthorized" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stylist_service_overrides")
    .select("service_id, custom_duration_minutes")
    .eq("stylist_id", stylistId);
  if (error) return { error: error.message };
  return { error: null, overrides: data ?? [] };
}

export async function upsertStylistServiceOverride(
  salonId: string,
  stylistId: string,
  serviceId: string,
  customDurationMinutes: number
): Promise<{ error: string | null }> {
  const context = await getCurrentUserSalon();
  if (!context || context.salon.id !== salonId) return { error: "Unauthorized" };
  const duration = Math.max(1, Math.min(480, Math.round(customDurationMinutes)));
  const supabase = await createClient();
  const { error } = await supabase
    .from("stylist_service_overrides")
    .upsert(
      { stylist_id: stylistId, service_id: serviceId, custom_duration_minutes: duration, updated_at: new Date().toISOString() },
      { onConflict: "stylist_id,service_id" }
    );
  if (error) return { error: error.message };
  revalidatePath("/team");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function deleteStylistServiceOverride(
  salonId: string,
  stylistId: string,
  serviceId: string
): Promise<{ error: string | null }> {
  const context = await getCurrentUserSalon();
  if (!context || context.salon.id !== salonId) return { error: "Unauthorized" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("stylist_service_overrides")
    .delete()
    .eq("stylist_id", stylistId)
    .eq("service_id", serviceId);
  if (error) return { error: error.message };
  revalidatePath("/team");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function setMemberPasscode(
  salonId: string,
  memberId: string,
  pin: string
): Promise<{ error: string | null }> {
  const context = await getCurrentUserSalon();
  if (!context || context.salon.id !== salonId) return { error: "Unauthorized" };
  if (context.member.role !== "owner") return { error: "Only owners can set passcodes" };
  if (!/^\d{4}$/.test(pin)) return { error: "Passcode must be exactly 4 digits" };
  const hashed = hashPasscode(pin);
  const supabase = await createClient();
  const { error } = await supabase
    .from("salon_members")
    .update({ passcode_hash: hashed })
    .eq("id", memberId)
    .eq("salon_id", salonId);
  if (error) {
    const msg = (error.message ?? "").toLowerCase();
    if (msg.includes("passcode_hash") && (msg.includes("does not exist") || msg.includes("schema cache"))) {
      return { error: "Passcode column not available yet. Run the latest migration." };
    }
    return { error: error.message };
  }
  revalidatePath("/team");
  return { error: null };
}

export async function clearMemberPasscode(
  salonId: string,
  memberId: string
): Promise<{ error: string | null }> {
  const context = await getCurrentUserSalon();
  if (!context || context.salon.id !== salonId) return { error: "Unauthorized" };
  if (context.member.role !== "owner") return { error: "Only owners can clear passcodes" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("salon_members")
    .update({ passcode_hash: null })
    .eq("id", memberId)
    .eq("salon_id", salonId);
  if (error) return { error: error.message };
  revalidatePath("/team");
  return { error: null };
}

export async function uploadTeamMemberAvatar(
  salonId: string,
  memberId: string,
  formData: FormData
): Promise<{ error: string | null; url?: string }> {
  const context = await getCurrentUserSalon();
  if (!context || context.salon.id !== salonId) return { error: "Unauthorized" };
  if (context.member.role !== "owner") return { error: "Only owners can update team avatars" };

  const raw = formData.get("avatar");
  if (!raw || typeof raw !== "object" || !("size" in raw) || !("type" in raw)) return { error: "No file provided" };
  const size = Number((raw as { size?: number }).size) || 0;
  const type = String((raw as { type?: string }).type || "").toLowerCase();
  if (size === 0) return { error: "No file provided" };
  if (size > MAX_AVATAR_BYTES) return { error: "Image must be under 2MB" };
  if (!ALLOWED_TYPES.includes(type)) return { error: "Allowed types: JPEG, PNG, GIF, WebP" };

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("salon_members")
    .select("id")
    .eq("id", memberId)
    .eq("salon_id", salonId)
    .single();
  if (!member) return { error: "Member not found" };

  const name = (raw as { name?: string }).name || "image.jpg";
  const ext = name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${salonId}/${memberId}.${ext}`;
  const admin = createAdminClient();

  const arrayBuffer = await (raw as Blob).arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const { error: uploadError } = await admin.storage
    .from(AVATAR_BUCKET)
    .upload(path, buffer, { upsert: true, contentType: type });

  if (uploadError) return { error: uploadError.message };

  const { data: urlData } = admin.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  const url = urlData.publicUrl;

  const { error: updateError } = await supabase
    .from("salon_members")
    .update({ avatar_url: url })
    .eq("id", memberId)
    .eq("salon_id", salonId);
  if (updateError) return { error: updateError.message };

  revalidatePath("/team");
  return { error: null, url };
}

export async function completeStaffOnboarding(salonId: string, memberId: string) {
  const supabase = await createClient();
  const context = await getCurrentUserSalon();
  if (!context || context.salon.id !== salonId) return { error: "Unauthorized" };
  if (context.member.role !== "owner") return { error: "Only owners can complete staff onboarding" };

  const { error } = await supabase
    .from("salon_members")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", memberId)
    .eq("salon_id", salonId);

  if (error) {
    const msg = error.message ?? "";
    if (/onboarding_completed_at|does not exist|42703/i.test(msg)) {
      revalidatePath("/team");
      return { error: null };
    }
    return { error: error.message };
  }

  revalidatePath("/team");
  return { error: null };
}
