import { revalidatePath } from "next/cache";
import { getMutateClient } from "@core/supabase/mutate-client";
import { getCurrentUserNailSalon } from "@modules/nail/lib/shop";

export async function executeDeleteNailAppointment(id: string): Promise<{ error: string | null }> {
  const context = await getCurrentUserNailSalon();
  if (!context) return { error: "Unauthorized" };

  const db = await getMutateClient();

  const { error } = await db
    .from("nail_appointments")
    .delete()
    .eq("id", id)
    .eq("salon_id", context.salon.id);

  if (error) return { error: error.message };

  try {
    revalidatePath("/nail/diary");
  } catch {
    /* revalidatePath may not be available in Route Handler context */
  }

  return { error: null };
}
