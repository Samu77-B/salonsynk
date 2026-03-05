"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { revalidatePath } from "next/cache";

export async function createClientAction(data: {
  salonId: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
}) {
  const supabase = await createClient();
  const context = await getCurrentUserSalon();
  if (!context || context.salon.id !== data.salonId) return { error: "Unauthorized" };

  const { error } = await supabase.from("clients").insert({
    salon_id: data.salonId,
    name: data.name?.trim() || null,
    email: data.email?.trim() || null,
    phone: data.phone?.trim() || null,
    notes: data.notes?.trim() || null,
  });

  if (error) return { error: error.message };
  revalidatePath("/clients");
  return { error: null };
}

export async function updateClientAction(
  id: string,
  updates: { name?: string; email?: string; phone?: string; notes?: string; color_formulas?: unknown; patch_test_due_at?: string | null }
) {
  const supabase = await createClient();
  const context = await getCurrentUserSalon();
  if (!context) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("clients")
    .update(updates)
    .eq("id", id)
    .eq("salon_id", context.salon.id);

  if (error) return { error: error.message };
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { error: null };
}
