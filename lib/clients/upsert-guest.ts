import type { SupabaseClient } from "@supabase/supabase-js";

export function normalizePhoneDigits(phone: string | null | undefined): string {
  let d = (phone ?? "").replace(/\D/g, "");
  if (d.startsWith("0") && d.length >= 10) d = "44" + d.slice(1);
  return d;
}

export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizePhoneDigits(a);
  const right = normalizePhoneDigits(b);
  if (!left || !right) return false;
  return left === right || left.endsWith(right) || right.endsWith(left);
}

export async function findClientByContact(
  db: SupabaseClient,
  salonId: string,
  email?: string | null,
  phone?: string | null
): Promise<{
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  last_skin_test_at: string | null;
  color_formulas: unknown;
} | null> {
  const emailNorm = email?.trim().toLowerCase() ?? "";
  if (emailNorm) {
    const { data } = await db
      .from("clients")
      .select("id, name, email, phone, last_skin_test_at, color_formulas")
      .eq("salon_id", salonId)
      .ilike("email", emailNorm)
      .limit(5);
    const match = (data ?? []).find((row) => (row.email ?? "").trim().toLowerCase() === emailNorm);
    if (match) return match as never;
  }

  const digits = normalizePhoneDigits(phone);
  if (digits.length >= 10) {
    const { data } = await db
      .from("clients")
      .select("id, name, email, phone, last_skin_test_at, color_formulas")
      .eq("salon_id", salonId)
      .not("phone", "is", null)
      .limit(400);
    const match = (data ?? []).find((row) => phonesMatch(row.phone, phone));
    if (match) return match as never;
  }

  return null;
}

export async function upsertGuestClient(
  db: SupabaseClient,
  params: {
    salonId: string;
    name: string;
    email: string;
    phone?: string | null;
  }
): Promise<{ clientId: string; created: boolean; error?: string }> {
  const name = params.name.trim();
  const email = params.email.trim().toLowerCase();
  const phone = params.phone?.trim() || null;

  const existing = await findClientByContact(db, params.salonId, email, phone);
  if (existing) {
    const patch: Record<string, unknown> = {};
    if (!existing.name && name) patch.name = name;
    if (!existing.email && email) patch.email = email;
    if (!existing.phone && phone) patch.phone = phone;
    if (Object.keys(patch).length > 0) {
      await db.from("clients").update(patch).eq("id", existing.id).eq("salon_id", params.salonId);
    }
    return { clientId: existing.id, created: false };
  }

  const { data: row, error } = await db
    .from("clients")
    .insert({
      salon_id: params.salonId,
      name: name || null,
      email: email || null,
      phone,
    })
    .select("id")
    .single();

  if (error || !row) return { clientId: "", created: false, error: error?.message ?? "Could not create client" };
  return { clientId: row.id as string, created: true };
}
