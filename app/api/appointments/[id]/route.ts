import { NextRequest, NextResponse } from "next/server";
import { executeDeleteAppointment } from "@/lib/appointments/delete-appointment";
import { executeAppointmentPatch, type UpdateAppointmentInput } from "@/lib/appointments/patch-appointment";

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing appointment id" }, { status: 400 });
  }

  try {
    const result = await executeDeleteAppointment(id);
    const status = result.error ? 400 : 200;
    return NextResponse.json(result, { status });
  } catch (e) {
    console.error("[api/appointments/[id] DELETE]", e);
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing appointment id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await executeAppointmentPatch(id, body as UpdateAppointmentInput);
    const status = result.error ? 400 : 200;
    return NextResponse.json(result, { status });
  } catch (e) {
    console.error("[api/appointments/[id] PATCH]", e);
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
