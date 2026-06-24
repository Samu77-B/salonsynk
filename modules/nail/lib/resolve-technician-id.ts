import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Master admin uses id "admin" — resolve to a real nail_members row for FK columns. */
export async function resolveActingTechnicianId(
  supabase: SupabaseClient,
  salonId: string,
  memberId: string
): Promise<{ technicianId?: string; error?: string }> {
  if (UUID_RE.test(memberId)) return { technicianId: memberId };

  const { data: preferred } = await supabase
    .from("nail_members")
    .select("id")
    .eq("salon_id", salonId)
    .eq("is_active", true)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();

  if (preferred?.id) return { technicianId: preferred.id };

  const { data: anyMember } = await supabase
    .from("nail_members")
    .select("id")
    .eq("salon_id", salonId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (anyMember?.id) return { technicianId: anyMember.id };

  return { error: "No technician on this salon to assign. Add a team member first." };
}
