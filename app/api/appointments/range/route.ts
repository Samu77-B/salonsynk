import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserSalon } from "@/lib/supabase/salon";

type RangeRequest = {
  stylistId: string;
  fromIso: string;
  toIso: string;
};

export async function POST(req: NextRequest) {
  const context = await getCurrentUserSalon();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const raw = body as Partial<RangeRequest>;
  const stylistId = typeof raw.stylistId === "string" ? raw.stylistId.trim() : "";
  const fromIso = typeof raw.fromIso === "string" ? raw.fromIso.trim() : "";
  const toIso = typeof raw.toIso === "string" ? raw.toIso.trim() : "";

  if (!stylistId || !fromIso || !toIso) {
    return NextResponse.json({ error: "Missing stylistId/fromIso/toIso" }, { status: 400 });
  }

  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("id, start_time, end_time, status, stylist_id")
    .eq("salon_id", context.salon.id)
    .eq("stylist_id", stylistId)
    .in("status", ["scheduled", "completed"])
    .gte("start_time", from.toISOString())
    .lt("start_time", to.toISOString())
    .order("start_time", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ error: null, appointments: data ?? [] }, { status: 200 });
}

