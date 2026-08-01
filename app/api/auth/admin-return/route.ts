import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { consumePendingAdminReturn } from "@core/auth/admin-handoff-state";
import { isAllowedAdminReturnPath } from "@core/auth/admin-switch-next";

/**
 * Reads back the master-admin destination parked during a cross-domain handoff.
 * Used when the session arrives in a URL fragment, so the server-side callback
 * never ran and could not consume it.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await getIsSuperAdmin())) {
    return NextResponse.json({ path: null });
  }

  const pending = await consumePendingAdminReturn(user.id);
  const path = pending && isAllowedAdminReturnPath(pending) ? pending : null;

  return NextResponse.json({ path });
}
