import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIsSuperAdmin } from "@core/supabase/admin-auth";
import { NAIL_SITE } from "@core/config/nail-site";

const ADMIN_SALON_COOKIE = "admin_nail_salon_id";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const salonId = requestUrl.searchParams.get("salonId");

  if (requestUrl.hostname.includes("smartsynk.net")) {
    const target = new URL("/api/admin/switch-nail-salon", NAIL_SITE.url);
    if (salonId) target.searchParams.set("salonId", salonId);
    return NextResponse.redirect(target);
  }

  const ok = await getIsSuperAdmin();
  if (!ok) return NextResponse.redirect(new URL("/dashboard", request.url));

  if (!salonId) return NextResponse.redirect(new URL("/admin/nail-salons", request.url));

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SALON_COOKIE, salonId, { path: "/", maxAge: 60 * 60 * 24 * 7 });

  return NextResponse.redirect(new URL("/nail/queue", request.url));
}
