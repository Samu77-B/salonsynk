"use server";

import { createClient } from "@core/supabase/server";
import { getCurrentUserNailSalon } from "@modules/nail/lib/shop";
import { revalidatePath } from "next/cache";
import { parseCsvRows } from "@/lib/simple-csv";

const CLIENTS_PATH = "/nail/clients";

export async function createNailClientAction(data: {
  salonId: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
}): Promise<{ error: string | null; clientId?: string }> {
  const context = await getCurrentUserNailSalon();
  if (!context || context.salon.id !== data.salonId) return { error: "Unauthorized" };

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("nail_clients")
    .insert({
      salon_id: data.salonId,
      name: data.name?.trim() || null,
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      notes: data.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath(CLIENTS_PATH);
  if (row?.id) revalidatePath(`${CLIENTS_PATH}/${row.id}`);
  return { error: null, clientId: row.id };
}

export async function updateNailClientAction(
  id: string,
  updates: {
    name?: string;
    email?: string;
    phone?: string;
    notes?: string;
    patch_test_due_at?: string | null;
    last_skin_test_at?: string | null;
  }
) {
  const context = await getCurrentUserNailSalon();
  if (!context) return { error: "Unauthorized" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("nail_clients")
    .update(updates)
    .eq("id", id)
    .eq("salon_id", context.salon.id);

  if (error) return { error: error.message };
  revalidatePath(CLIENTS_PATH);
  revalidatePath(`${CLIENTS_PATH}/${id}`);
  return { error: null };
}

export type CsvImportRowError = { line: number; message: string };

const MAX_CLIENT_CSV_ROWS = 2000;

function normCsvHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

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

export async function importNailClientsFromCsv(
  salonId: string,
  csvText: string
): Promise<{
  error: string | null;
  added: number;
  skipped: number;
  rowErrors: CsvImportRowError[];
}> {
  const context = await getCurrentUserNailSalon();
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
    col.phone !== undefined;
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
  const existingEmails = new Set<string>();
  const existingPhones = new Set<string>();
  {
    const { data: existing, error: existingErr } = await supabase
      .from("nail_clients")
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
    });
  }

  if (payloads.length === 0) {
    return { error: null, added: 0, skipped, rowErrors };
  }

  const CHUNK = 500;
  let added = 0;
  for (let i = 0; i < payloads.length; i += CHUNK) {
    const slice = payloads.slice(i, i + CHUNK);
    const { error } = await supabase.from("nail_clients").insert(slice);
    if (error) {
      return { error: error.message, added, skipped, rowErrors };
    }
    added += slice.length;
  }

  revalidatePath(CLIENTS_PATH);
  return { error: null, added, skipped, rowErrors };
}
