import { NextResponse } from "next/server";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const context = await getCurrentUserSalon();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("salon_members")
    .select("id, display_name, passcode_hash, is_active")
    .eq("salon_id", context.salon.id)
    .eq("is_active", true)
    .order("display_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const members = (data ?? []).map((m) => ({
    id: (m as { id: string }).id,
    display_name: (m as { display_name: string | null }).display_name,
    has_passcode: Boolean((m as { passcode_hash?: string | null }).passcode_hash),
  }));

  return NextResponse.json({ members });
}

