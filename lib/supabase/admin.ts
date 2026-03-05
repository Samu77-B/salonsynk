import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Server-only. Use for guest booking and cron where RLS must be bypassed.
 */
export function createAdminClient() {
  if (!url?.trim() || !key?.trim()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY required for admin operations");
  }
  return createClient(url, key);
}
