import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "./server";
import { createAdminClient } from "./admin";
import { getIsSuperAdmin } from "./admin-auth";

/** Super admins often view a salon via cookie without a salon_members row; RLS would block writes. */
export async function getMutateClient(): Promise<SupabaseClient> {
  const userSb = await createClient();
  if (!(await getIsSuperAdmin())) return userSb;
  try {
    return createAdminClient();
  } catch {
    return userSb;
  }
}
