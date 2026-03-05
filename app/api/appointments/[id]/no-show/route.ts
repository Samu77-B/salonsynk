import { NextResponse } from "next/server";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const context = await getCurrentUserSalon();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const supabase = await createClient();
  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, deposit_payment_intent_id, salon_id")
    .eq("id", id)
    .eq("salon_id", context.salon.id)
    .single();

  if (!appointment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (appointment.deposit_payment_intent_id) {
    try {
      const stripe = getStripe();
      await stripe.paymentIntents.capture(appointment.deposit_payment_intent_id);
    } catch (err) {
      console.error("Capture failed:", err);
    }
  }

  const { error } = await supabase
    .from("appointments")
    .update({ status: "no_show" })
    .eq("id", id)
    .eq("salon_id", context.salon.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
