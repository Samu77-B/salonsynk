import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIsSuperAdmin } from "@core/supabase/admin-auth";
import { NAIL_SITE } from "@core/config/nail-site";
import { sanitizeAdminSwitchNext } from "@core/auth/admin-switch-next";

const ADMIN_SALON_COOKIE = "admin_nail_salon_id";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const salonId = requestUrl.searchParams.get("salonId");
  const next = sanitizeAdminSwitchNext(requestUrl.searchParams.get("next"), "/nail/queue");

  if (requestUrl.hostname.includes("smartsynk.net")) {
    const target = new URL("/api/admin/switch-nail-salon", NAIL_SITE.url);
    if (salonId) target.searchParams.set("salonId", salonId);
    if (next !== "/nail/queue") target.searchParams.set("next", next);
    return NextResponse.redirect(target);
  }

  const ok = await getIsSuperAdmin();
  if (!ok) return NextResponse.redirect(new URL("/dashboard", request.url));

  if (!salonId) return NextResponse.redirect(new URL("/admin/nail-salons", request.url));

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SALON_COOKIE, salonId, { path: "/", maxAge: 60 * 60 * 24 * 7 });

  return NextResponse.redirect(new URL(next, request.url));
}
