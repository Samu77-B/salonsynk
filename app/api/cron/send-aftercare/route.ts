import { NextResponse } from "next/server";
import { sendAftercare } from "@/lib/aftercare";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const results = await sendAftercare(2);
  return NextResponse.json({ sent: results.filter((r) => r.ok).length, results });
}

export async function POST(request: Request) {
  return GET(request);
}
