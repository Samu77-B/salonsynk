import { createClient } from "@/lib/supabase/server";
import { sendSupportMessage } from "@/lib/email";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { salonName, userEmail, subject, message } = body;

    if (!salonName || typeof salonName !== "string") {
      return NextResponse.json({ error: "Salon name required" }, { status: 400 });
    }
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    const fromEmail = userEmail || user.email || "";
    const subj = (typeof subject === "string" ? subject : "Support request").slice(0, 200);
    const msg = String(message).slice(0, 5000);

    const result = await sendSupportMessage(fromEmail, salonName, subj, msg);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
