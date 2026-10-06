import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyHairService } from "@/lib/booking-policy";
import { findClientByContact } from "./upsert-guest";

function serviceNameFromJoin(services: { name?: string } | { name?: string }[] | null | undefined): string | null {
  if (!services) return null;
  if (Array.isArray(services)) return services[0]?.name ?? null;
  return services.name ?? null;
}

export async function isReturningColourClient(
  db: SupabaseClient,
  salonId: string,
  email?: string | null,
  phone?: string | null
): Promise<boolean> {
  const client = await findClientByContact(db, salonId, email, phone);
  if (client) {
    const formulas = client.color_formulas;
    if (Array.isArray(formulas) && formulas.length > 0) return true;
    if (client.last_skin_test_at) return true;

    const { data: appts } = await db
      .from("appointments")
      .select("id, status, services(name)")
      .eq("salon_id", salonId)
      .eq("client_id", client.id)
      .in("status", ["scheduled", "completed"])
      .limit(50);

    for (const row of appts ?? []) {
      const name = serviceNameFromJoin((row as { services?: { name?: string } | { name?: string }[] | null }).services);
      if (name && classifyHairService(name).isColour) return true;
    }
  }

  const emailNorm = email?.trim().toLowerCase() ?? "";
  if (emailNorm) {
    const { data: guestAppts } = await db
      .from("appointments")
      .select("services(name)")
      .eq("salon_id", salonId)
      .in("status", ["scheduled", "completed"])
      .ilike("guest_email", emailNorm)
      .limit(30);
    for (const row of guestAppts ?? []) {
      const name = serviceNameFromJoin((row as { services?: { name?: string } | { name?: string }[] | null }).services);
      if (name && classifyHairService(name).isColour) return true;
    }
  }

  return false;
}
