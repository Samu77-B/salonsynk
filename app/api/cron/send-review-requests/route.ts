import { NextResponse } from "next/server";
import { sendReviewRequests } from "@/lib/review-requests";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Send review requests for appointments that ended 2 hours ago
  const results = await sendReviewRequests(2);
  return NextResponse.json({ sent: results.filter((r) => r.ok).length, results });
}

export async function POST(request: Request) {
  return GET(request);
}
