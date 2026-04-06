import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { findClientsForEmptySlots, type SlotWithCandidates } from "@/lib/gap-filler";

export type { SlotWithCandidates };

export async function executeGetEmptySlotCandidates(): Promise<{
  error?: string;
  data?: SlotWithCandidates[];
}> {
  const context = await getCurrentUserSalon();
  if (!context) return { error: "Unauthorized" };
  const supabase = await createClient();
  try {
    const data = await findClientsForEmptySlots(supabase, context.salon.id);
    return { data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
