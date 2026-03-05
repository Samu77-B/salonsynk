"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { revalidatePath } from "next/cache";

export async function inviteOrAddTeamMember(
  salonId: string,
  data: { display_name: string; role: "owner" | "stylist"; email?: string }
) {
  const supabase = await createClient();
  const context = await getCurrentUserSalon();
  if (!context || context.salon.id !== salonId) return { error: "Unauthorized" };
  if (context.member.role !== "owner") return { error: "Only owners can add team members" };

  if (data.email?.trim()) {
    const token = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
    const { error } = await supabase.from("salon_invites").insert({
      salon_id: salonId,
      email: data.email.trim().toLowerCase(),
      role: data.role,
      display_name: data.display_name.trim() || null,
      token,
    });
    if (error) {
      if (error.code === "23505") return { error: "An invite for this email already exists" };
      return { error: error.message };
    }
    revalidatePath("/team");
    return { error: null };
  }

  return { error: "Email is required to invite a team member" };
}

export async function updateTeamMember(
  id: string,
  updates: { display_name?: string; holiday_ranges?: string[]; is_active?: boolean }
) {
  const supabase = await createClient();
  const context = await getCurrentUserSalon();
  if (!context) return { error: "Unauthorized" };

  const payload: Record<string, unknown> = {};
  if (updates.display_name !== undefined) payload.display_name = updates.display_name;
  if (updates.is_active !== undefined) payload.is_active = updates.is_active;
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
