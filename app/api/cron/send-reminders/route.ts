import { NextResponse } from "next/server";
import { sendReminders } from "@/lib/reminders";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const results = await sendReminders(24);
  return NextResponse.json({ sent: results.filter((r) => r.ok).length, results });
}

export async function POST(request: Request) {
  return GET(request);
}
