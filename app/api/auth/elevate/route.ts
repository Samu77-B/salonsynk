import { NextResponse } from "next/server";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { verifyPasscode, createStaffElevationToken } from "@/lib/passcode";
import { STAFF_ELEVATION_COOKIE } from "@/lib/staff-elevation";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { isManagerRole } from "@/lib/dashboard-roles";

export async function POST(request: Request) {
  const context = await getCurrentUserSalon();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const isSuperAdmin = await getIsSuperAdmin();
  if (isManagerRole(isSuperAdmin, context.member.role ?? "")) {
    return NextResponse.json({ ok: true, elevated: true });
  }

  const body = (await request.json()) as { memberId?: string; pin?: string };
  const memberId = body.memberId;
  const pin = body.pin;
  if (!memberId) return NextResponse.json({ error: "Choose your name" }, { status: 400 });
  if (!pin || !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: "Enter a 4-digit PIN" }, { status: 400 });
  }

  const supabase = await createClient();
  let passcodeHash: string | null = null;
  try {
    const { data } = await supabase
      .from("salon_members")
      .select("passcode_hash")
      .eq("id", memberId)
      .eq("salon_id", context.salon.id)
      .eq("is_active", true)
      .single();
    passcodeHash = (data as { passcode_hash?: string | null } | null)?.passcode_hash ?? null;
  } catch {
    // column may not exist
  }

  if (!passcodeHash) {
    return NextResponse.json({ error: "No passcode set for that team member" }, { status: 422 });
  }
  if (!verifyPasscode(pin, passcodeHash)) {
    return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
  }

  const token = createStaffElevationToken(memberId, context.salon.id);
  const response = NextResponse.json({ ok: true, elevated: true });
  response.cookies.set(STAFF_ELEVATION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 15 * 60,
  });
  return response;
}

