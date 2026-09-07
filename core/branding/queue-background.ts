import type { CSSProperties } from "react";
import { createAdminClient } from "@core/supabase/admin";

export function parseQueueBackgroundColor(
  settings: Record<string, unknown> | null | undefined
): string {
  const branding = (settings?.branding as Record<string, unknown>) ?? {};
  const value = branding.queue_background_color;
  return typeof value === "string" ? value.trim() : "";
}

export function queueBackgroundShellClass(baseClassName: string, color: string): string {
  return `${baseClassName}${color ? "" : " bg-canvas"}`;
}

export function queueBackgroundShellStyle(color: string): CSSProperties | undefined {
  return color ? { backgroundColor: color } : undefined;
}

type QueueBrandTable = "barber_shops" | "nail_salons" | "salons";

export async function loadQueueBackgroundColor(
  table: QueueBrandTable,
  id: string
): Promise<string> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from(table).select("settings").eq("id", id).single();
    return parseQueueBackgroundColor((data?.settings as Record<string, unknown>) ?? undefined);
  } catch {
    return "";
  }
}
