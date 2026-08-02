import { createAdminClient } from "@core/supabase/admin";

/** True if the user is an active member of the given tenant (any role). */
export async function userIsActiveTenantMember(
  userId: string,
  platform: "salon" | "barber" | "nail",
  tenantId: string
): Promise<boolean> {
  const admin = createAdminClient();
  if (platform === "salon") {
    const { data } = await admin
      .from("salon_members")
      .select("id")
      .eq("user_id", userId)
      .eq("salon_id", tenantId)
      .eq("is_active", true)
      .maybeSingle();
    return Boolean(data);
  }
  if (platform === "barber") {
    const { data } = await admin
      .from("barber_members")
      .select("id")
      .eq("user_id", userId)
      .eq("shop_id", tenantId)
      .eq("is_active", true)
      .maybeSingle();
    return Boolean(data);
  }
  const { data } = await admin
    .from("nail_members")
    .select("id")
    .eq("user_id", userId)
    .eq("salon_id", tenantId)
    .eq("is_active", true)
    .maybeSingle();
  return Boolean(data);
}
