import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { verifyPasscode, createPinSessionToken } from "@/lib/passcode";

export async function POST(request: Request) {
  const context = await getCurrentUserSalon();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const body = (await request.json()) as { pin?: string };
  const pin = body.pin;
  if (!pin || !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: "Enter a 4-digit PIN" }, { status: 400 });
  }

  const supabase = await createClient();
  let passcodeHash: string | null = null;
  try {
    const { data } = await supabase
      .from("salon_members")
      .select("passcode_hash")
      .eq("id", context.member.id)
      .eq("salon_id", context.salon.id)
      .single();
    passcodeHash = (data as { passcode_hash?: string | null } | null)?.passcode_hash ?? null;
  } catch {
    // column may not exist
  }

  if (!passcodeHash) {
    return NextResponse.json({ error: "No passcode set for your account" }, { status: 422 });
  }

  if (!verifyPasscode(pin, passcodeHash)) {
    return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
  }

  const token = createPinSessionToken(context.member.id, context.salon.id);
  const response = NextResponse.json({ ok: true });
  response.cookies.set("pin_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60,
  });
  return response;
}
