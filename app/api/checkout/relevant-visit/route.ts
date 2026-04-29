import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";

type Line = { service_id: string; sort_order: number };

type AppointmentRow = {
  id: string;
  start_time: string;
  stylist_id: string;
  service_id: string | null;
  appointment_services?: Line[] | Line | null;
};

function normalizeLines(raw: AppointmentRow["appointment_services"]): Line[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && "service_id" in raw)
    return [{ service_id: raw.service_id as string, sort_order: 0 }];
  return [];
}

function serviceIdsFromAppointment(row: AppointmentRow): string[] {
  const lines = normalizeLines(row.appointment_services).filter((l) => l?.service_id);
  if (lines.length > 0) {
    return [...lines]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((l) => l.service_id);
  }
  if (row.service_id) return [row.service_id];
  return [];
}

function pickAppointment(rows: AppointmentRow[], preferredStylistId: string): AppointmentRow | null {
  if (rows.length === 0) return null;
  const stylistFirst = rows.filter((r) => r.stylist_id === preferredStylistId);
  const pool = stylistFirst.length > 0 ? stylistFirst : rows;
  return (
    [...pool].sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())[0] ?? null
  );
}

/** Returns service line IDs from the client’s most relevant recent visit (for checkout prefill). */
export async function GET(req: NextRequest) {
  const context = await getCurrentUserSalon();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = req.nextUrl.searchParams.get("clientId")?.trim() ?? "";
  const stylistId = req.nextUrl.searchParams.get("stylistId")?.trim() ?? "";

  if (!clientId) {
    return NextResponse.json({ error: null as string | null, serviceIds: [] as string[], appointmentId: null as string | null });
  }

  const from = new Date();
  from.setDate(from.getDate() - 3);
  from.setHours(0, 0, 0, 0);
  const to = new Date();
  to.setDate(to.getDate() + 2);
  to.setHours(23, 59, 59, 999);

  const supabase = await createClient();
  const preferred = stylistId || context.member.id;

  const withLines = await supabase
    .from("appointments")
    .select("id, start_time, stylist_id, status, service_id, appointment_services(service_id, sort_order)")
    .eq("salon_id", context.salon.id)
    .eq("client_id", clientId)
    .in("status", ["scheduled", "completed"])
    .gte("start_time", from.toISOString())
    .lte("start_time", to.toISOString())
    .order("start_time", { ascending: false })
    .limit(30);

  let rows: AppointmentRow[] = [];

  if (!withLines.error && withLines.data) {
    rows = withLines.data as AppointmentRow[];
  } else {
    const minimal = await supabase
      .from("appointments")
      .select("id, start_time, stylist_id, status, service_id")
      .eq("salon_id", context.salon.id)
      .eq("client_id", clientId)
      .in("status", ["scheduled", "completed"])
      .gte("start_time", from.toISOString())
      .lte("start_time", to.toISOString())
      .order("start_time", { ascending: false })
      .limit(30);
    if (minimal.error) {
      return NextResponse.json({ error: minimal.error.message }, { status: 500 });
    }
    rows = (minimal.data ?? []) as unknown as AppointmentRow[];
  }

  const apt = pickAppointment(rows, preferred);
  if (!apt) {
    return NextResponse.json({ error: null, serviceIds: [], appointmentId: null });
  }

  return NextResponse.json({
    error: null,
    serviceIds: serviceIdsFromAppointment(apt),
    appointmentId: apt.id,
  });
}
