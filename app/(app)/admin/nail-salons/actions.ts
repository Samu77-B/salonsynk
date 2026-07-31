"use server";

import { createAdminClient } from "@core/supabase/admin";
import { getIsSuperAdmin } from "@core/supabase/admin-auth";
import { uploadTeamAvatarImage } from "@core/storage/team-avatar";
import { revalidatePath } from "next/cache";

export type NailBrandingInput = {
  logo_url?: string;
  primary_color?: string;
  company_name?: string;
  /** When false, hide the salon title on the public join queue page (logo only). */
  show_title_on_queue?: boolean;
  /** When true, customers only see "Next available" — no named technician choice. */
  next_available_only?: boolean;
  /** When false, hide the service dropdown on the public join queue page. */
  show_services_on_queue?: boolean;
};

const LOGO_BUCKET = "team-avatars";
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];

async function requireAdmin() {
  const ok = await getIsSuperAdmin();
  if (!ok) throw new Error("Unauthorized");
}

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function linkOwnerByEmail(
  admin: ReturnType<typeof createAdminClient>,
  salonId: string,
  ownerEmail: string
): Promise<{ error?: string; linked?: boolean }> {
  const email = ownerEmail.trim().toLowerCase();
  if (!email) return {};

  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .eq("email", email)
    .maybeSingle();

  if (!profile) {
    return {
      error:
        "No user found with that email. Create them in Supabase Authentication first, then add them here.",
    };
  }

  const displayName =
    (profile.full_name as string) || profile.email?.split("@")[0] || "Owner";

  const { error: memberError } = await admin.from("nail_members").upsert(
    {
      salon_id: salonId,
      user_id: profile.id,
      role: "owner",
      display_name: displayName,
      is_active: true,
      is_accepting_walk_ins: false,
    },
    { onConflict: "salon_id,user_id" }
  );

  if (memberError) return { error: memberError.message };
  return { linked: true };
}

export async function adminCreateNailSalon(
  name: string,
  slug: string,
  ownerEmail?: string,
  branding?: NailBrandingInput
): Promise<{ error?: string; salonId?: string; ownerWarning?: string }> {
  await requireAdmin();
  const admin = createAdminClient();
  const finalSlug = (slug || slugFromName(name)).trim();
  if (!finalSlug) return { error: "Slug is required" };

  const settings: Record<string, unknown> = {};
  if (branding && Object.keys(branding).length > 0) {
    settings.branding = {
      ...(branding.logo_url?.trim() ? { logo_url: branding.logo_url.trim() } : {}),
      ...(branding.primary_color?.trim() ? { primary_color: branding.primary_color.trim() } : {}),
      ...(branding.company_name?.trim()
        ? { company_name: branding.company_name.trim() }
        : { company_name: name.trim() }),
    };
  }

  const { data: salon, error: salonError } = await admin
    .from("nail_salons")
    .insert({
      name: name.trim(),
      slug: finalSlug,
      subscription_status: "inactive",
      subscription_required: false,
      ...(Object.keys(settings).length ? { settings } : {}),
    })
    .select("id")
    .single();

  if (salonError) {
    if (salonError.code === "23505") return { error: "That slug is already taken" };
    return { error: salonError.message };
  }

  let ownerWarning: string | undefined;
  if (ownerEmail?.trim()) {
    const linkResult = await linkOwnerByEmail(admin, salon.id, ownerEmail);
    if (linkResult.error) ownerWarning = linkResult.error;
  }

  revalidatePath("/admin");
  revalidatePath("/admin/nail-salons");
  revalidatePath(`/nail/join/${finalSlug}`);
  return { salonId: salon.id, ownerWarning };
}

export async function adminUploadNailSalonLogo(
  salonId: string,
  formData: FormData
): Promise<{ error: string | null; url?: string }> {
  try {
    await requireAdmin();
    const admin = createAdminClient();

    const raw = formData.get("logo");
    if (!raw || typeof raw !== "object" || !("size" in raw) || !("type" in raw)) {
      return { error: "No file provided" };
    }
    const size = Number((raw as { size?: number }).size) || 0;
    const type = String((raw as { type?: string }).type || "").toLowerCase();
    if (size === 0) return { error: "No file provided" };
    if (size > MAX_LOGO_BYTES) return { error: "Image must be under 2MB" };
    if (!ALLOWED_LOGO_TYPES.includes(type)) {
      return { error: `File type "${type}" not allowed. Use JPEG, PNG, GIF, WebP, or SVG.` };
    }

    const name = (raw as { name?: string }).name || "logo.png";
    const ext = name.split(".").pop()?.toLowerCase() || "png";
    const path = `nail-logos/${salonId}.${ext}`;

    const arrayBuffer = await (raw as Blob).arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const { error: uploadError } = await admin.storage
      .from(LOGO_BUCKET)
      .upload(path, buffer, { upsert: true, contentType: type });

    if (uploadError) return { error: `Upload failed: ${uploadError.message}` };

    const { data: urlData } = admin.storage.from(LOGO_BUCKET).getPublicUrl(path);
    const url = urlData.publicUrl;

    const { data: existing } = await admin
      .from("nail_salons")
      .select("settings, slug")
      .eq("id", salonId)
      .single();
    if (!existing) return { error: "Salon not found" };

    const current = (existing.settings as Record<string, unknown>) ?? {};
    const branding = (current.branding as Record<string, unknown>) ?? {};
    const nextBranding = { ...branding, logo_url: url };
    const { error: updateError } = await admin
      .from("nail_salons")
      .update({ settings: { ...current, branding: nextBranding } })
      .eq("id", salonId);
    if (updateError) return { error: updateError.message };

    revalidatePath("/admin/nail-salons");
    revalidatePath(`/admin/nail-salons/${salonId}`);
    if (existing.slug) revalidatePath(`/nail/join/${existing.slug}`);
    return { error: null, url };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown upload error";
    return { error: msg };
  }
}

export async function adminUpdateNailSalon(
  salonId: string,
  updates: {
    name?: string;
    slug?: string;
    branding?: NailBrandingInput;
  }
): Promise<{ error?: string }> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("nail_salons")
    .select("settings, slug")
    .eq("id", salonId)
    .single();
  if (!existing) return { error: "Salon not found" };

  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (updates.slug !== undefined) payload.slug = updates.slug.trim();
  if (updates.branding !== undefined) {
    const current = (existing.settings as Record<string, unknown>) ?? {};
    const merged = {
      ...((current.branding as Record<string, unknown>) ?? {}),
      ...updates.branding,
    };
    if ("logo_url" in updates.branding && !updates.branding.logo_url?.trim()) {
      delete merged.logo_url;
    }
    payload.settings = { ...current, branding: merged };
  }

  const { error } = await admin.from("nail_salons").update(payload).eq("id", salonId);
  if (error) {
    if (error.code === "23505") return { error: "That slug is already taken" };
    return { error: error.message };
  }

  revalidatePath("/admin/nail-salons");
  revalidatePath(`/admin/nail-salons/${salonId}`);
  const slug = (updates.slug ?? existing.slug) as string;
  if (slug) revalidatePath(`/nail/join/${slug}`);
  return {};
}

export async function adminAddNailSalonOwner(
  salonId: string,
  ownerEmail: string
): Promise<{ error?: string }> {
  await requireAdmin();
  const admin = createAdminClient();
  const linkResult = await linkOwnerByEmail(admin, salonId, ownerEmail);
  if (linkResult.error) return { error: linkResult.error };

  revalidateNailSalon(salonId);
  return {};
}

/** Create owner with email + password directly. No email verification. */
export async function adminCreateNailOwnerWithPassword(
  salonId: string,
  email: string,
  password: string,
  displayName?: string
): Promise<{ error?: string }> {
  await requireAdmin();
  const admin = createAdminClient();
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { error: "Email is required" };
  if (!password || password.length < 6) return { error: "Password must be at least 6 characters" };

  const name = displayName?.trim() || trimmed.split("@")[0] || "Owner";

  const { data: userData, error: createError } = await admin.auth.admin.createUser({
    email: trimmed,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });

  if (createError) {
    const msg = createError.message?.toLowerCase() ?? "";
    if (msg.includes("already") || msg.includes("registered")) {
      return { error: "That email is already registered. Use Add owner instead." };
    }
    return { error: createError.message };
  }

  const userId = userData?.user?.id;
  if (!userId) return { error: "User created but could not add as owner." };

  const { error: memberError } = await admin.from("nail_members").upsert(
    {
      salon_id: salonId,
      user_id: userId,
      role: "owner",
      display_name: name,
      is_active: true,
      is_accepting_walk_ins: false,
    },
    { onConflict: "salon_id,user_id" }
  );

  if (memberError) return { error: memberError.message };
  revalidateNailSalon(salonId);
  return {};
}

async function revalidateNailSalon(salonId: string) {
  const admin = createAdminClient();
  const { data: salon } = await admin.from("nail_salons").select("slug").eq("id", salonId).single();
  revalidatePath("/admin/nail-salons");
  revalidatePath(`/admin/nail-salons/${salonId}`);
  if (salon?.slug) revalidatePath(`/nail/join/${salon.slug}`);
}

async function linkTechnicianByEmail(
  admin: ReturnType<typeof createAdminClient>,
  salonId: string,
  email: string,
  displayName: string,
  stationNumber?: number | null
): Promise<{ error?: string; memberId?: string }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return { error: "Email is required to link an account" };

  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .eq("email", normalized)
    .maybeSingle();

  if (!profile) {
    return {
      error:
        "No user found with that email. Create them in Supabase Authentication first, then add them here.",
    };
  }

  const name =
    displayName.trim() ||
    (profile.full_name as string) ||
    profile.email?.split("@")[0] ||
    "Technician";

  const { data: member, error } = await admin
    .from("nail_members")
    .upsert(
      {
        salon_id: salonId,
        user_id: profile.id,
        role: "technician",
        display_name: name,
        station_number: stationNumber ?? null,
        is_active: true,
        is_accepting_walk_ins: true,
      },
      { onConflict: "salon_id,user_id" }
    )
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { memberId: member?.id };
}

export async function adminAddNailMember(
  salonId: string,
  data: {
    display_name: string;
    email?: string;
    station_number?: number | null;
  }
): Promise<{ error?: string; memberId?: string }> {
  await requireAdmin();
  const admin = createAdminClient();
  const displayName = data.display_name?.trim();
  if (!displayName) return { error: "Display name is required" };

  const stationNumber =
    data.station_number != null && !Number.isNaN(data.station_number)
      ? Number(data.station_number)
      : null;

  if (data.email?.trim()) {
    const result = await linkTechnicianByEmail(
      admin,
      salonId,
      data.email,
      displayName,
      stationNumber
    );
    if (result.error) return { error: result.error };
    await revalidateNailSalon(salonId);
    return { memberId: result.memberId };
  }

  const { data: member, error } = await admin
    .from("nail_members")
    .insert({
      salon_id: salonId,
      user_id: null,
      role: "technician",
      display_name: displayName,
      station_number: stationNumber,
      is_active: true,
      is_accepting_walk_ins: true,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  await revalidateNailSalon(salonId);
  return { memberId: member?.id };
}

export async function adminUpdateNailMember(
  salonId: string,
  memberId: string,
  updates: {
    display_name?: string;
    station_number?: number | null;
    is_accepting_walk_ins?: boolean;
    is_active?: boolean;
  }
): Promise<{ error?: string }> {
  await requireAdmin();
  const admin = createAdminClient();

  const payload: Record<string, unknown> = {};
  if (updates.display_name !== undefined) payload.display_name = updates.display_name.trim();
  if (updates.station_number !== undefined) {
    payload.station_number =
      updates.station_number != null && !Number.isNaN(updates.station_number)
        ? Number(updates.station_number)
        : null;
  }
  if (updates.is_accepting_walk_ins !== undefined) {
    payload.is_accepting_walk_ins = updates.is_accepting_walk_ins;
  }
  if (updates.is_active !== undefined) payload.is_active = updates.is_active;

  const { error } = await admin
    .from("nail_members")
    .update(payload)
    .eq("id", memberId)
    .eq("salon_id", salonId);

  if (error) return { error: error.message };
  await revalidateNailSalon(salonId);
  return {};
}

export async function adminRemoveNailMember(
  salonId: string,
  memberId: string
): Promise<{ error?: string }> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: member } = await admin
    .from("nail_members")
    .select("id, role")
    .eq("id", memberId)
    .eq("salon_id", salonId)
    .single();

  if (!member) return { error: "Team member not found" };
  if (member.role === "owner") return { error: "Cannot remove the salon owner" };

  const { count: appointmentCount } = await admin
    .from("nail_appointments")
    .select("id", { count: "exact", head: true })
    .eq("technician_id", memberId);

  if ((appointmentCount ?? 0) > 0) {
    const { error } = await admin
      .from("nail_members")
      .update({ is_active: false, is_accepting_walk_ins: false })
      .eq("id", memberId)
      .eq("salon_id", salonId);
    if (error) return { error: error.message };
    await revalidateNailSalon(salonId);
    return {};
  }

  const { error } = await admin
    .from("nail_members")
    .delete()
    .eq("id", memberId)
    .eq("salon_id", salonId);

  if (error) return { error: error.message };
  await revalidateNailSalon(salonId);
  return {};
}

export async function adminUploadNailMemberAvatar(
  salonId: string,
  memberId: string,
  formData: FormData
): Promise<{ error: string | null; url?: string }> {
  try {
    await requireAdmin();
    const admin = createAdminClient();

    const { data: member } = await admin
      .from("nail_members")
      .select("id")
      .eq("id", memberId)
      .eq("salon_id", salonId)
      .single();
    if (!member) return { error: "Technician not found" };

    const raw = formData.get("avatar");
    if (!raw || typeof raw !== "object" || !("size" in raw)) {
      return { error: "No file provided" };
    }

    const name = (raw as { name?: string }).name || "avatar.jpg";
    const ext = name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `nail-avatars/${salonId}/${memberId}.${ext}`;

    const upload = await uploadTeamAvatarImage(
      path,
      raw as Blob & { name?: string; type?: string; size?: number }
    );
    if (upload.error || !upload.url) return { error: upload.error ?? "Upload failed" };

    const { data: updated, error: updateError } = await admin
      .from("nail_members")
      .update({ avatar_url: upload.url })
      .eq("id", memberId)
      .eq("salon_id", salonId)
      .select("avatar_url")
      .single();

    if (updateError) return { error: updateError.message };
    if (!updated?.avatar_url) {
      return { error: "Photo saved to storage but could not update profile" };
    }

    await revalidateNailSalon(salonId);
    return { error: null, url: updated.avatar_url };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown upload error";
    return { error: msg };
  }
}

export async function adminDeleteNailSalon(salonId: string) {
  await requireAdmin();
  const supabase = createAdminClient();

  // Ordered deletes — appointments reference members/services with ON DELETE RESTRICT.
  const { data: appointmentIds } = await supabase
    .from("nail_appointments")
    .select("id")
    .eq("salon_id", salonId);

  const ids = (appointmentIds ?? []).map((a) => a.id);
  if (ids.length > 0) {
    const { error: e0 } = await supabase
      .from("nail_appointment_services")
      .delete()
      .in("appointment_id", ids);
    if (e0) return { error: e0.message };
  }

  const steps: { table: string; column: string }[] = [
    { table: "nail_sales_transactions", column: "salon_id" },
    { table: "nail_appointments", column: "salon_id" },
    { table: "nail_queue", column: "salon_id" },
    { table: "nail_clients", column: "salon_id" },
    { table: "nail_services", column: "salon_id" },
    { table: "nail_service_categories", column: "salon_id" },
    { table: "nail_members", column: "salon_id" },
  ];

  for (const step of steps) {
    const { error } = await supabase.from(step.table).delete().eq(step.column, salonId);
    if (error) return { error: error.message };
  }

  const { error } = await supabase.from("nail_salons").delete().eq("id", salonId);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/admin/nail-salons");
  return {};
}
