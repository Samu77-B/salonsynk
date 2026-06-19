import type { SupabaseClient } from "@supabase/supabase-js";

/** Renumber waiting entries to 1, 2, 3… so position matches live queue order. */
export async function compactQueuePositions(
  supabase: SupabaseClient,
  shopId: string
): Promise<void> {
  const { data: waiting } = await supabase
    .from("barber_queue")
    .select("id, position")
    .eq("shop_id", shopId)
    .eq("status", "waiting")
    .order("position", { ascending: true });

  if (!waiting?.length) return;

  await Promise.all(
    waiting.map((entry, index) => {
      const expected = index + 1;
      if (entry.position === expected) return Promise.resolve();
      return supabase
        .from("barber_queue")
        .update({ position: expected })
        .eq("id", entry.id)
        .eq("shop_id", shopId);
    })
  );
}

/** Next position for a new waiting customer (1-based, matches dashboard numbering). */
export async function getNextQueuePosition(
  supabase: SupabaseClient,
  shopId: string
): Promise<number> {
  await compactQueuePositions(supabase, shopId);

  const { count } = await supabase
    .from("barber_queue")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shopId)
    .eq("status", "waiting");

  return (count ?? 0) + 1;
}
