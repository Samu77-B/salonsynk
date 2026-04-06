import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { getMutateClient } from "@/lib/supabase/mutate-client";
import { revalidatePath } from "next/cache";

export async function executeDeleteAppointment(
  id: string
): Promise<{ error: string | null }> {
  const context = await getCurrentUserSalon();
  if (!context) return { error: "Unauthorized" };

  const db = await getMutateClient();

  const { error } = await db
    .from("appointments")
    .delete()
    .eq("id", id)
    .eq("salon_id", context.salon.id);

  if (error) return { error: error.message };

  try {
    revalidatePath("/dashboard");
  } catch { /* revalidatePath may not be available in Route Handler context */ }

  return { error: null };
}
