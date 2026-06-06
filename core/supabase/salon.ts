import { cookies } from "next/headers";
import { createClient } from "@core/supabase/server";
import { createAdminClient } from "@core/supabase/admin";
import { getIsSuperAdmin } from "@core/supabase/admin-auth";

export type SalonWithMember = {
  salon: { id: string; name: string; slug: string };
  member: { id: string; role: string; display_name: string | null };
};

const ADMIN_SALON_COOKIE = "admin_salon_id";

/**
 * Fetch the current user's salon and membership (for layout/dashboard).
 * Super admins: can switch to any salon via cookie; get owner-level access.
 * Returns null if user has no salon (needs onboarding).
 * Uses admin client for salon_members/salons queries to avoid RLS blocking the lookup.
 */
export async function getCurrentUserSalon(): Promise<SalonWithMember | null> {
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
    const salonId = cookieStore.get(ADMIN_SALON_COOKIE)?.value;
    if (salonId) {
      const { data: salon } = await admin
        .from("salons")
        .select("id, name, slug")
        .eq("id", salonId)
        .single();
      if (salon) {
        return {
          salon: { id: salon.id, name: salon.name, slug: salon.slug },
          member: {
            id: "admin",
            role: "owner",
            display_name: "Master Admin",
          },
        };
      }
    }
    const { data: members } = await admin
      .from("salon_members")
      .select("id, salon_id, role, display_name")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1);
    if (members?.length) {
      const { data: salon } = await admin
        .from("salons")
        .select("id, name, slug")
        .eq("id", members[0].salon_id)
        .single();
      if (salon) {
        return {
          salon: { id: salon.id, name: salon.name, slug: salon.slug },
          member: {
            id: members[0].id,
            role: members[0].role,
            display_name: members[0].display_name ?? null,
          },
        };
      }
    }
    const { data: firstSalon } = await admin
      .from("salons")
      .select("id, name, slug")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();
    if (firstSalon) {
      return {
        salon: { id: firstSalon.id, name: firstSalon.name, slug: firstSalon.slug },
        member: { id: "admin", role: "owner", display_name: "Master Admin" },
      };
    }
  }

  const { data: members } = await admin
    .from("salon_members")
    .select("id, salon_id, role, display_name")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1);

  if (!members?.length) return null;

  const { data: salon } = await admin
    .from("salons")
    .select("id, name, slug")
    .eq("id", members[0].salon_id)
    .single();

  if (!salon) return null;

  return {
    salon: { id: salon.id, name: salon.name, slug: salon.slug },
    member: {
      id: members[0].id,
      role: members[0].role,
      display_name: members[0].display_name ?? null,
    },
  };
}
