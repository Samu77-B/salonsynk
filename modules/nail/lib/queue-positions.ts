import type { SupabaseClient } from "@supabase/supabase-js";

export async function compactQueuePositions(
  supabase: SupabaseClient,
  salonId: string
): Promise<void> {
  const { data: waiting } = await supabase
    .from("nail_queue")
    .select("id, position")
    .eq("salon_id", salonId)
    .eq("status", "waiting")
    .order("position", { ascending: true });

  if (!waiting?.length) return;

  await Promise.all(
    waiting.map((entry, index) => {
      const expected = index + 1;
      if (entry.position === expected) return Promise.resolve();
      return supabase
        .from("nail_queue")
        .update({ position: expected })
        .eq("id", entry.id)
        .eq("salon_id", salonId);
    })
  );
}

export async function getNextQueuePosition(
  supabase: SupabaseClient,
  salonId: string
): Promise<number> {
  await compactQueuePositions(supabase, salonId);

  const { count } = await supabase
    .from("nail_queue")
    .select("id", { count: "exact", head: true })
    .eq("salon_id", salonId)
    .eq("status", "waiting");

  return (count ?? 0) + 1;
}
