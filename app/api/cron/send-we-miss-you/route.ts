import { NextResponse } from "next/server";
import { sendWeMissYouCampaign } from "@/lib/we-miss-you";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Uses each salon's configured window from Settings by default.
  const results = await sendWeMissYouCampaign();
  return NextResponse.json({ sent: results.filter((r) => r.ok).length, results });
}

export async function POST(request: Request) {
  return GET(request);
}
