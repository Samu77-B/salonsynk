import { NextRequest, NextResponse } from "next/server";
import {
  createAppointment,
  type CreateAppointmentInput,
} from "@/app/(app)/(dashboard)/dashboard/actions";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await createAppointment(body as CreateAppointmentInput);
    const status = result.error ? 400 : 200;
    return NextResponse.json(result, { status });
  } catch (e) {
    console.error("[api/appointments POST]", e);
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
