import { createClient } from "./server";

export type SalonWithMember = {
  salon: { id: string; name: string; slug: string };
  member: { id: string; role: string; display_name: string | null };
};

/**
 * Fetch the current user's first salon and membership (for layout/dashboard).
 * Returns null if user has no salon_members row (needs onboarding).
 */
export async function getCurrentUserSalon(): Promise<SalonWithMember | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: members } = await supabase
    .from("salon_members")
    .select("id, salon_id, role, display_name")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1);

  if (!members?.length) return null;

  const { data: salon } = await supabase
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
