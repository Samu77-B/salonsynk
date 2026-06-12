import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Master admin uses id "admin" — resolve to a real barber_members row for FK columns. */
export async function resolveActingBarberId(
  supabase: SupabaseClient,
  shopId: string,
  memberId: string
): Promise<{ barberId?: string; error?: string }> {
  if (UUID_RE.test(memberId)) return { barberId: memberId };

  const { data: preferred } = await supabase
    .from("barber_members")
    .select("id")
    .eq("shop_id", shopId)
    .eq("is_active", true)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();

  if (preferred?.id) return { barberId: preferred.id };

  const { data: anyMember } = await supabase
    .from("barber_members")
    .select("id")
    .eq("shop_id", shopId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (anyMember?.id) return { barberId: anyMember.id };

  return { error: "No barber on this shop to assign. Add a team member first." };
}
