import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getIsSuperAdmin } from "@core/supabase/admin-auth";
import { BARBER_SITE } from "@core/config/barber-site";
import { sanitizeAdminSwitchNext } from "@core/auth/admin-switch-next";

const ADMIN_SHOP_COOKIE = "admin_barber_shop_id";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const shopId = requestUrl.searchParams.get("shopId");
  const next = sanitizeAdminSwitchNext(requestUrl.searchParams.get("next"), "/barber/dashboard");

  if (requestUrl.hostname.includes("smartsynk.net")) {
    const target = new URL("/api/admin/switch-barber-shop", BARBER_SITE.url);
    if (shopId) target.searchParams.set("shopId", shopId);
    if (next !== "/barber/dashboard") target.searchParams.set("next", next);
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

  if (!shopId) return NextResponse.redirect(new URL("/admin/barber-shops", request.url));

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SHOP_COOKIE, shopId, { path: "/", maxAge: 60 * 60 * 24 * 7 });

  return NextResponse.redirect(new URL(next, request.url));
}
