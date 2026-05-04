"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { revalidatePath } from "next/cache";
import { requireStaffElevationOrError } from "@/lib/staff-elevation";
import { parseCsvRows } from "@/lib/simple-csv";

export async function createClientAction(data: {
  salonId: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  sex?: string | null;
  marketing_opt_in?: boolean;
}): Promise<{ error: string | null; clientId?: string }> {
  const supabase = await createClient();
  const context = await getCurrentUserSalon();
  if (!context || context.salon.id !== data.salonId) return { error: "Unauthorized" };

  const { data: row, error } = await supabase
    .from("clients")
    .insert({
      salon_id: data.salonId,
      name: data.name?.trim() || null,
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      notes: data.notes?.trim() || null,
      sex: data.sex || null,
      marketing_opt_in: data.marketing_opt_in !== false,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/clients");
  if (row?.id) revalidatePath(`/clients/${row.id}`);
  return { error: null, clientId: row.id };
}

export async function updateClientAction(
  id: string,
  updates: {
    name?: string;
    email?: string;
    phone?: string;
    notes?: string;
    sex?: string | null;
    marketing_opt_in?: boolean;
    color_formulas?: unknown;
    patch_test_due_at?: string | null;
    last_skin_test_at?: string | null;
  }
) {
  const supabase = await createClient();
  const context = await getCurrentUserSalon();
  if (!context) return { error: "Unauthorized" };

  const elevationError = await requireStaffElevationOrError({
    salonId: context.salon.id,
    memberRole: context.member.role ?? "",
  });
  if (elevationError) return { error: elevationError };

  const payload: Record<string, unknown> = { ...updates };

  // Gracefully handle missing last_skin_test_at column
  let { error } = await supabase
    .from("clients")
    .update(payload)
    .eq("id", id)
    .eq("salon_id", context.salon.id);

  if (error && payload.last_skin_test_at !== undefined) {
    const msg = (error.message ?? "").toLowerCase();
    if (msg.includes("last_skin_test_at") && (msg.includes("does not exist") || msg.includes("schema cache"))) {
      const { last_skin_test_at: _, ...rest } = payload;
      const retry = await supabase.from("clients").update(rest).eq("id", id).eq("salon_id", context.salon.id);
      error = retry.error;
    }
  }

  if (error) return { error: error.message };
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { error: null };
}

// ── Client Notes ──

export type ClientNote = {
  id: string;
  note: string;
  note_type: string;
  created_by: string | null;
  created_at: string;
};

export async function addClientNote(
  clientId: string,
  salonId: string,
  note: string,
  noteType: string = "general"
): Promise<{ error: string | null; noteRow?: ClientNote }> {
  const context = await getCurrentUserSalon();
  if (!context || context.salon.id !== salonId) return { error: "Unauthorized" };
  const text = note.trim();
  if (!text) return { error: "Note cannot be empty" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("client_notes")
    .insert({ client_id: clientId, salon_id: salonId, note: text, note_type: noteType, created_by: user?.id ?? null })
    .select("id, note, note_type, created_by, created_at")
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/clients/${clientId}`);
  return { error: null, noteRow: data as ClientNote };
}

export async function deleteClientNote(
  noteId: string,
  clientId: string
): Promise<{ error: string | null }> {
  const context = await getCurrentUserSalon();
  if (!context) return { error: "Unauthorized" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("client_notes")
    .delete()
    .eq("id", noteId)
    .eq("salon_id", context.salon.id);
  if (error) return { error: error.message };
  revalidatePath(`/clients/${clientId}`);
  return { error: null };
}

// ── Client Photos ──

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
  try {
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
    const file = raw as File;
    if (file.size === 0) return { error: "No file provided" };
    if (file.size > MAX_PHOTO_BYTES) return { error: "Photo must be under 5 MB" };
    const type = (file.type || "").toLowerCase();
    if (!ALLOWED_PHOTO_TYPES.includes(type)) return { error: "Allowed: JPEG, PNG, WebP, HEIC" };

    const ext = file.name?.split(".").pop()?.toLowerCase() || "jpg";
    const storagePath = `${context.salon.id}/${clientId}-${slot}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return { error: "Storage not configured" };
    }

    const { error: uploadError } = await admin.storage
      .from(PHOTO_BUCKET)
      .upload(storagePath, bytes, { upsert: true, contentType: type });
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
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Upload failed" };
  }
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

// ── CSV Import ──

export type CsvImportRowError = { line: number; message: string };

const MAX_CLIENT_CSV_ROWS = 2000;

function normCsvHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

function parseBoolCell(raw: string | undefined, defaultValue: boolean): boolean {
  if (raw === undefined) return defaultValue;
  const x = raw.trim().toLowerCase();
  if (x === "") return defaultValue;
  if (["1", "true", "yes", "y", "on"].includes(x)) return true;
  if (["0", "false", "no", "n", "off"].includes(x)) return false;
  return defaultValue;
}

function normalizeSex(raw: string | undefined): string | null {
  const x = (raw ?? "").trim().toLowerCase();
  if (x === "male" || x === "m") return "male";
  if (x === "female" || x === "f") return "female";
  return null;
}

// Strip non-digits except leading '+', so '+44 7700 900 000' and '07700900000' compare consistently.
function normalizePhoneForCompare(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  const hasPlus = s.startsWith("+");
  const digits = s.replace(/[^\d]/g, "");
  return hasPlus ? `+${digits}` : digits;
}

function normalizeEmailForCompare(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase();
}

export async function importClientsFromCsv(
  salonId: string,
  csvText: string
): Promise<{
  error: string | null;
  added: number;
  skipped: number;
  rowErrors: CsvImportRowError[];
}> {
  const context = await getCurrentUserSalon();
  if (!context || context.salon.id !== salonId) {
    return { error: "Unauthorized", added: 0, skipped: 0, rowErrors: [] };
  }

  const rows = parseCsvRows(csvText);
  if (rows.length < 2) {
    return {
      error: "Add a header row and at least one client row.",
      added: 0,
      skipped: 0,
      rowErrors: [],
    };
  }

  const headerCells = rows[0]!.map(normCsvHeader);
  const col: Record<string, number> = {};
  headerCells.forEach((h, i) => {
    if (h && col[h] === undefined) col[h] = i;
  });

  function pick(row: string[], ...keys: string[]): string | undefined {
    for (const k of keys) {
      const j = col[k];
      if (j !== undefined && row[j] !== undefined) return row[j];
    }
    return undefined;
  }

  const hasAnyIdColumn =
    col.name !== undefined ||
    col.full_name !== undefined ||
    col.email !== undefined ||
    col.email_address !== undefined ||
    col.phone !== undefined ||
    col.mobile !== undefined ||
    col.phone_number !== undefined;
  if (!hasAnyIdColumn) {
    return {
      error: 'CSV must include at least one of: "name", "email", or "phone".',
      added: 0,
      skipped: 0,
      rowErrors: [],
    };
  }

  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_CLIENT_CSV_ROWS) {
    return {
      error: `Too many rows (max ${MAX_CLIENT_CSV_ROWS}). Split into multiple files.`,
      added: 0,
      skipped: 0,
      rowErrors: [],
    };
  }

  const supabase = await createClient();

  // Pull existing clients for de-dup; cap at a reasonable size for typical salons.
  const existingEmails = new Set<string>();
  const existingPhones = new Set<string>();
  {
    const { data: existing, error: existingErr } = await supabase
      .from("clients")
      .select("email, phone")
      .eq("salon_id", salonId)
      .limit(20000);
    if (existingErr) {
      return { error: existingErr.message, added: 0, skipped: 0, rowErrors: [] };
    }
    for (const r of existing ?? []) {
      const e = normalizeEmailForCompare((r as { email: string | null }).email);
      if (e) existingEmails.add(e);
      const p = normalizePhoneForCompare((r as { phone: string | null }).phone);
      if (p) existingPhones.add(p);
    }
  }

  type Payload = {
    salon_id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    notes: string | null;
    sex: string | null;
    marketing_opt_in: boolean;
  };

  const payloads: Payload[] = [];
  const rowErrors: CsvImportRowError[] = [];
  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();
  let skipped = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]!;
    const lineNum = i + 2;

    const name = (pick(row, "name", "full_name") ?? "").trim() || null;
    const emailRaw = (pick(row, "email", "email_address") ?? "").trim();
    const email = emailRaw ? emailRaw.toLowerCase() : null;
    const phoneRaw = (pick(row, "phone", "mobile", "phone_number") ?? "").trim() || null;
    const notes = (pick(row, "notes", "note") ?? "").trim() || null;
    const sex = normalizeSex(pick(row, "sex", "gender"));
    const marketing_opt_in = parseBoolCell(pick(row, "marketing_opt_in", "marketing", "opt_in"), true);

    if (!name && !email && !phoneRaw) {
      rowErrors.push({ line: lineNum, message: "Row must include name, email, or phone" });
      continue;
    }

    if (email && !email.includes("@")) {
      rowErrors.push({ line: lineNum, message: "Invalid email" });
      continue;
    }

    const emailKey = normalizeEmailForCompare(email);
    const phoneKey = normalizePhoneForCompare(phoneRaw);

    if (emailKey && (existingEmails.has(emailKey) || seenEmails.has(emailKey))) {
      skipped++;
      continue;
    }
    if (phoneKey && (existingPhones.has(phoneKey) || seenPhones.has(phoneKey))) {
      skipped++;
      continue;
    }

    if (emailKey) seenEmails.add(emailKey);
    if (phoneKey) seenPhones.add(phoneKey);

    payloads.push({
      salon_id: salonId,
      name,
      email,
      phone: phoneRaw,
      notes,
      sex,
      marketing_opt_in,
    });
  }

  if (payloads.length === 0) {
    return { error: null, added: 0, skipped, rowErrors };
  }

  // Insert in chunks to avoid oversized payloads.
  const CHUNK = 500;
  let added = 0;
  for (let i = 0; i < payloads.length; i += CHUNK) {
    const slice = payloads.slice(i, i + CHUNK);
    const { error } = await supabase.from("clients").insert(slice);
    if (error) {
      return {
        error: error.message,
        added,
        skipped,
        rowErrors,
      };
    }
    added += slice.length;
  }

  revalidatePath("/clients");
  return { error: null, added, skipped, rowErrors };
}
