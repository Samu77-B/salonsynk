import { cookies } from "next/headers";
import { createClient } from "@core/supabase/server";
import { createAdminClient } from "@core/supabase/admin";
import { getIsSuperAdmin } from "@core/supabase/admin-auth";

export type ShopWithMember = {
  shop: { id: string; name: string; slug: string };
  member: { id: string; role: string; display_name: string | null };
};

const ADMIN_SHOP_COOKIE = "admin_barber_shop_id";

/**
 * Fetch the current user's barber shop and membership.
 * Mirrors getCurrentUserSalon() from the Salon module.
 */
export async function getCurrentUserShop(): Promise<ShopWithMember | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const isSuperAdmin = await getIsSuperAdmin();
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    admin = supabase;
  }

  if (isSuperAdmin) {
    const cookieStore = await cookies();
    const shopId = cookieStore.get(ADMIN_SHOP_COOKIE)?.value;
    if (shopId) {
      const { data: shop } = await admin
        .from("barber_shops")
        .select("id, name, slug")
        .eq("id", shopId)
        .single();
      if (shop) {
        return {
          shop: { id: shop.id, name: shop.name, slug: shop.slug },
          member: { id: "admin", role: "owner", display_name: "Master Admin" },
        };
      }
    }
  }

  const { data: members } = await admin
    .from("barber_members")
    .select("id, shop_id, role, display_name")
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (!members?.length) return null;

  const cookieStore = await cookies();
  const preferredShopId = cookieStore.get(ADMIN_SHOP_COOKIE)?.value;
  const preferred =
    preferredShopId != null
      ? members.find((m: { shop_id: string }) => m.shop_id === preferredShopId)
      : undefined;
  const member = preferred ?? members[0];

  const { data: shop } = await admin
    .from("barber_shops")
    .select("id, name, slug")
    .eq("id", member.shop_id)
    .single();

  if (!shop) return null;

  return {
    shop: { id: shop.id, name: shop.name, slug: shop.slug },
    member: {
      id: member.id,
      role: member.role,
      display_name: member.display_name ?? null,
    },
  };
}
