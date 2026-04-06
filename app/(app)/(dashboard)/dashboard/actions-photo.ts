import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { getMutateClient } from "@/lib/supabase/mutate-client";
import { revalidatePath } from "next/cache";

const PHOTO_BUCKET = "appointment-photos";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

export async function uploadAppointmentPhotoInner(
  appointmentId: string,
  field: "before" | "after",
  formData: FormData
): Promise<{ error: string | null; url?: string }> {
  const context = await getCurrentUserSalon();
  if (!context) return { error: "Unauthorized" };

  const db = await getMutateClient();

  const { data: apt } = await db
    .from("appointments")
    .select("id")
    .eq("id", appointmentId)
    .eq("salon_id", context.salon.id)
    .single();
  if (!apt) return { error: "Appointment not found" };

  const raw = formData.get("photo");
  if (!raw || typeof raw !== "object" || !("size" in raw)) return { error: "No file provided" };
  const size = Number((raw as Blob).size) || 0;
  const type = String((raw as File).type || "").toLowerCase();
  if (size === 0) return { error: "No file provided" };
  if (size > MAX_PHOTO_BYTES) return { error: "Photo must be under 5 MB" };
  if (!ALLOWED_PHOTO_TYPES.includes(type)) return { error: "Allowed: JPEG, PNG, WebP, HEIC" };

  const ext = (raw as File).name?.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${context.salon.id}/${appointmentId}-${field}.${ext}`;

  const arrayBuffer = await (raw as Blob).arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "Storage not configured" };
  }

  const { error: uploadError } = await admin.storage
    .from(PHOTO_BUCKET)
    .upload(path, buffer, { upsert: true, contentType: type });

  if (uploadError) return { error: uploadError.message };

  const { data: urlData } = admin.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  const url = urlData.publicUrl;

  const col = field === "before" ? "before_photo_url" : "after_photo_url";
  await db
    .from("appointments")
    .update({ [col]: url })
    .eq("id", appointmentId)
    .eq("salon_id", context.salon.id);

  try {
    revalidatePath("/dashboard");
  } catch { /* may not be available outside RSC context */ }

  return { error: null, url };
}
