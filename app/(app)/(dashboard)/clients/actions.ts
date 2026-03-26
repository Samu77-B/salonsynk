"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { revalidatePath } from "next/cache";

export async function createClientAction(data: {
  salonId: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  sex?: string | null;
}) {
  const supabase = await createClient();
  const context = await getCurrentUserSalon();
  if (!context || context.salon.id !== data.salonId) return { error: "Unauthorized" };

  const { error } = await supabase.from("clients").insert({
    salon_id: data.salonId,
    name: data.name?.trim() || null,
    email: data.email?.trim() || null,
    phone: data.phone?.trim() || null,
    notes: data.notes?.trim() || null,
    sex: data.sex || null,
  });

  if (error) return { error: error.message };
  revalidatePath("/clients");
  return { error: null };
}

export async function updateClientAction(
  id: string,
  updates: {
    name?: string;
    email?: string;
    phone?: string;
    notes?: string;
    sex?: string | null;
    color_formulas?: unknown;
    patch_test_due_at?: string | null;
  }
) {
  const supabase = await createClient();
  const context = await getCurrentUserSalon();
  if (!context) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("clients")
    .update(updates)
    .eq("id", id)
    .eq("salon_id", context.salon.id);

  if (error) return { error: error.message };
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { error: null };
}

const PHOTO_BUCKET = "client-photos";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const VALID_SLOTS = ["profile", "photo_2", "photo_3", "photo_4"] as const;
export type PhotoSlot = (typeof VALID_SLOTS)[number];

export type ClientPhoto = {
  id: string;
  slot: PhotoSlot;
  url: string;
};

export async function uploadClientPhoto(
  clientId: string,
  slot: PhotoSlot,
  formData: FormData
): Promise<{ error: string | null; photo?: ClientPhoto }> {
  const context = await getCurrentUserSalon();
  if (!context) return { error: "Unauthorized" };
  if (!VALID_SLOTS.includes(slot)) return { error: "Invalid slot" };

  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("salon_id", context.salon.id)
    .single();
  if (!client) return { error: "Client not found" };

  const raw = formData.get("photo");
  if (!raw || typeof raw !== "object" || !("size" in raw)) return { error: "No file provided" };
  const size = Number((raw as Blob).size) || 0;
  const type = String((raw as File).type || "").toLowerCase();
  if (size === 0) return { error: "No file provided" };
  if (size > MAX_PHOTO_BYTES) return { error: "Photo must be under 5 MB" };
  if (!ALLOWED_PHOTO_TYPES.includes(type)) return { error: "Allowed: JPEG, PNG, WebP, HEIC" };

  const ext = (raw as File).name?.split(".").pop()?.toLowerCase() || "jpg";
  const storagePath = `${context.salon.id}/${clientId}-${slot}.${ext}`;

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
    .upload(storagePath, buffer, { upsert: true, contentType: type });
  if (uploadError) return { error: uploadError.message };

  const { data: urlData } = admin.storage.from(PHOTO_BUCKET).getPublicUrl(storagePath);
  const url = `${urlData.publicUrl}?t=${Date.now()}`;

  const { data: photo, error: dbError } = await admin
    .from("client_photos")
    .upsert(
      { client_id: clientId, salon_id: context.salon.id, slot, url },
      { onConflict: "client_id,slot" }
    )
    .select("id, slot, url")
    .single();

  if (dbError) return { error: dbError.message };

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  return { error: null, photo: photo as ClientPhoto };
}

export async function deleteClientPhoto(
  clientId: string,
  slot: PhotoSlot
): Promise<{ error: string | null }> {
  const context = await getCurrentUserSalon();
  if (!context) return { error: "Unauthorized" };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "Storage not configured" };
  }

  const { data: existing } = await admin
    .from("client_photos")
    .select("id, url")
    .eq("client_id", clientId)
    .eq("salon_id", context.salon.id)
    .eq("slot", slot)
    .single();

  if (!existing) return { error: "Photo not found" };

  const { data: files } = await admin.storage.from(PHOTO_BUCKET).list(context.salon.id, {
    search: `${clientId}-${slot}`,
  });
  if (files && files.length > 0) {
    await admin.storage
      .from(PHOTO_BUCKET)
      .remove(files.map((f) => `${context.salon.id}/${f.name}`));
  }

  await admin
    .from("client_photos")
    .delete()
    .eq("id", existing.id);

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  return { error: null };
}
