import { createHash, randomInt } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function hashPortalCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function generatePortalCode(): string {
  return String(randomInt(100000, 1000000));
}

export async function issuePortalCode(
  db: SupabaseClient,
  params: { salonId: string; clientId: string; contact: string }
): Promise<{ code: string } | { error: string }> {
  const code = generatePortalCode();
  const contact = params.contact.trim().toLowerCase();
  const { error } = await db.from("client_portal_codes").insert({
    salon_id: params.salonId,
    client_id: params.clientId,
    contact,
    code_hash: hashPortalCode(code),
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  });
  if (error) {
    const msg = (error.message ?? "").toLowerCase();
    if (msg.includes("client_portal_codes") && (msg.includes("does not exist") || msg.includes("schema cache"))) {
      return { error: "Club login is not set up yet. Please ask the salon." };
    }
    return { error: error.message };
  }
  return { code };
}

export async function consumePortalCode(
  db: SupabaseClient,
  params: { salonId: string; contact: string; code: string }
): Promise<{ clientId: string } | { error: string }> {
  const contact = params.contact.trim().toLowerCase();
  const { data: rows, error } = await db
    .from("client_portal_codes")
    .select("id, client_id, code_hash, expires_at, attempts")
    .eq("salon_id", params.salonId)
    .eq("contact", contact)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) return { error: error.message };
  const row = rows?.[0] as
    | { id: string; client_id: string; code_hash: string; expires_at: string; attempts: number }
    | undefined;
  if (!row) return { error: "That code has expired. Please request a new one." };

  if ((row.attempts ?? 0) >= MAX_ATTEMPTS) {
    return { error: "Too many attempts. Please request a new code." };
  }

  await db
    .from("client_portal_codes")
    .update({ attempts: (row.attempts ?? 0) + 1 })
    .eq("id", row.id);

  if (hashPortalCode(params.code.trim()) !== row.code_hash) {
    return { error: "That code is not correct." };
  }

  await db.from("client_portal_codes").delete().eq("id", row.id);
  return { clientId: row.client_id };
}
