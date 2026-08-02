import { cookies } from "next/headers";
import { createClient } from "@core/supabase/server";
import { createAdminClient } from "@core/supabase/admin";
import { getIsSuperAdmin } from "@core/supabase/admin-auth";

export type NailSalonWithMember = {
  salon: { id: string; name: string; slug: string };
  member: { id: string; role: string; display_name: string | null };
};

const ADMIN_SALON_COOKIE = "admin_nail_salon_id";

export async function getCurrentUserNailSalon(): Promise<NailSalonWithMember | null> {
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
        .from("nail_salons")
        .select("id, name, slug")
        .eq("id", salonId)
        .single();
      if (salon) {
        return {
          salon: { id: salon.id, name: salon.name, slug: salon.slug },
          member: { id: "admin", role: "owner", display_name: "Master Admin" },
        };
      }
    }
  }

  const { data: members } = await admin
    .from("nail_members")
    .select("id, salon_id, role, display_name")
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (!members?.length) return null;

  const cookieStore = await cookies();
  const preferredSalonId = cookieStore.get(ADMIN_SALON_COOKIE)?.value;
  const preferred =
    preferredSalonId != null
      ? members.find((m: { salon_id: string }) => m.salon_id === preferredSalonId)
      : undefined;
  const member = preferred ?? members[0];

  const { data: salon } = await admin
    .from("nail_salons")
    .select("id, name, slug")
    .eq("id", member.salon_id)
    .single();

  if (!salon) return null;

  return {
    salon: { id: salon.id, name: salon.name, slug: salon.slug },
    member: {
      id: member.id,
      role: member.role,
      display_name: member.display_name ?? null,
    },
  };
}
