import { NextResponse } from "next/server";
import { executeGetEmptySlotCandidates } from "@/lib/appointments/gap-filler-query";

export async function GET() {
  try {
    const result = await executeGetEmptySlotCandidates();
    if (result.error) {
      return NextResponse.json(result, { status: 401 });
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error("[api/dashboard/gap-filler GET]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
