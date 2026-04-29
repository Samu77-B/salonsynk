/**
 * salon_members.show_on_diary === false hides the member from diary columns,
 * checkout stylist pickers, and public booking stylist lists (e.g. front desk login only).
 */
export function memberShowsOnDiary(row: { show_on_diary?: boolean | null }): boolean {
  return row.show_on_diary !== false;
}

/** True when PostgREST reports the column is missing or not in schema cache (migration not applied yet). */
export function isMissingShowOnDiaryColumnError(error: { message?: string } | null | undefined): boolean {
  const msg = (error?.message ?? "").toLowerCase();
  return (
    msg.includes("show_on_diary") &&
    (msg.includes("does not exist") || msg.includes("schema cache") || msg.includes("could not find"))
  );
}

/** Try SELECT variants in order until one succeeds — avoids failures when migration 038 isn’t applied or optional columns vary. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchSalonMembersAdaptiveSelect(
  supabase: any,
  salonId: string,
  selectVariants: readonly string[],
  options?: { activeOnly?: boolean }
): Promise<{ data: unknown[]; error: { message?: string } | null }> {
  const activeOnly = options?.activeOnly ?? true;
  let lastErr: { message?: string } | null = null;

  for (const sel of selectVariants) {
    let q = supabase.from("salon_members").select(sel).eq("salon_id", salonId);
    if (activeOnly) q = q.eq("is_active", true);
    const r = await q.order("role", { ascending: false });
    lastErr = r.error ?? null;
    if (!r.error) return { data: Array.isArray(r.data) ? r.data : [], error: null };
  }

  return { data: [], error: lastErr };
}
