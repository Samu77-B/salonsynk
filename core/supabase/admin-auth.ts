import { createClient } from "@core/supabase/server";
import { createAdminClient } from "@core/supabase/admin";

/**
 * Returns the current user's profile is_super_admin flag.
 * Uses admin client so we can read any profile; call only after verifying auth.
 * Returns false gracefully if the admin client cannot be created (e.g. missing service role key).
 */
export async function getIsSuperAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return false;
  }
  const { data: profile } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  return profile?.is_super_admin === true;
}
