import { NextResponse } from "next/server";
import { sendAftercare } from "@/lib/aftercare";
import { sendReminders } from "@/lib/reminders";
import { sendReviewRequests } from "@/lib/review-requests";

function authorizeCron(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

/** Single daily cron for Vercel Hobby (max once/day, 2 cron slots). */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [reminders, aftercare, reviews] = await Promise.all([
    sendReminders(48),
    sendAftercare(2),
    sendReviewRequests(2),
  ]);

  return NextResponse.json({
    reminders: { sent: reminders.filter((r) => r.ok).length },
    aftercare: { sent: aftercare.filter((r) => r.ok).length },
    reviews: { sent: reviews.filter((r) => r.ok).length },
  });
}

export async function POST(request: Request) {
  return GET(request);
}
