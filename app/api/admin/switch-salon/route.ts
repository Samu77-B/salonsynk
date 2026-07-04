import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { SITE } from "@core/config/site";
import { sanitizeAdminSwitchNext } from "@core/auth/admin-switch-next";

const ADMIN_SALON_COOKIE = "admin_salon_id";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const salonId = requestUrl.searchParams.get("salonId");
  const next = sanitizeAdminSwitchNext(requestUrl.searchParams.get("next"), "/dashboard");

  if (requestUrl.hostname.includes("smartsynk.net")) {
    const target = new URL("/api/admin/switch-salon", SITE.url);
    if (salonId) target.searchParams.set("salonId", salonId);
    if (next !== "/dashboard") target.searchParams.set("next", next);
    return NextResponse.redirect(target);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${requestUrl.pathname}${requestUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  const ok = await getIsSuperAdmin();
  if (!ok) return NextResponse.redirect(new URL("/dashboard", request.url));

  if (!salonId) return NextResponse.redirect(new URL("/admin/salons", request.url));

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SALON_COOKIE, salonId, { path: "/", maxAge: 60 * 60 * 24 * 7 });
  return NextResponse.redirect(new URL(next, request.url));
}
