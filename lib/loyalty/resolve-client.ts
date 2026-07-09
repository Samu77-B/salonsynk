import type { SupabaseClient } from "@supabase/supabase-js";

export type WalkInLoyaltySignup = {
  joinLoyalty?: boolean;
  walkInName?: string;
  walkInEmail?: string;
  walkInPhone?: string;
};

export async function resolveCheckoutClientId(
  db: SupabaseClient,
  salonId: string,
  clientId: string | undefined,
  walkIn: WalkInLoyaltySignup
): Promise<{ clientId: string | null; error?: string }> {
  if (clientId?.trim()) {
    const { data: existing } = await db
      .from("clients")
      .select("id")
      .eq("id", clientId.trim())
      .eq("salon_id", salonId)
      .maybeSingle();
    if (!existing) return { clientId: null, error: "Client not found" };
    return { clientId: existing.id };
  }

  if (!walkIn.joinLoyalty) return { clientId: null };

  const name = walkIn.walkInName?.trim() ?? "";
  const email = walkIn.walkInEmail?.trim() ?? "";
  const phone = walkIn.walkInPhone?.trim() ?? "";

  if (!name) return { clientId: null, error: "Walk-in name is required to join the loyalty programme" };
  if (!email && !phone) {
    return { clientId: null, error: "Phone or email is required to join the loyalty programme" };
  }

  const { data: row, error } = await db
    .from("clients")
    .insert({
      salon_id: salonId,
      name,
      email: email || null,
      phone: phone || null,
      marketing_opt_in: true,
    })
    .select("id")
    .single();

  if (error || !row) return { clientId: null, error: error?.message ?? "Could not create client" };
  return { clientId: row.id };
}
