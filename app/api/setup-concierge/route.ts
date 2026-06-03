import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { sendSetupConciergeRequest } from "@/lib/email";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const context = await getCurrentUserSalon();
  if (!context || (context.member.role ?? "").toLowerCase() !== "owner") {
    return NextResponse.json({ error: "Only salon owners can request setup help." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const raw = body as {
    hasPriceLists?: boolean;
    helpAreas?: unknown;
    notes?: unknown;
  };

  if (typeof raw.hasPriceLists !== "boolean") {
    return NextResponse.json({ error: "Please indicate if price lists are ready." }, { status: 400 });
  }

  const helpAreas = Array.isArray(raw.helpAreas)
    ? raw.helpAreas.filter((x): x is string => typeof x === "string").slice(0, 20)
    : [];
  const notes = typeof raw.notes === "string" ? raw.notes.trim().slice(0, 4000) : undefined;

  const ownerName =
    context.member.display_name?.trim() ||
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    user.email.split("@")[0] ||
    "Owner";

  const result = await sendSetupConciergeRequest({
    ownerName,
    ownerEmail: user.email,
    salonName: context.salon.name,
    hasPriceLists: raw.hasPriceLists,
    helpAreas,
    notes,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
