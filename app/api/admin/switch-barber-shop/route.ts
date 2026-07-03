import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIsSuperAdmin } from "@core/supabase/admin-auth";
import { BARBER_SITE } from "@core/config/barber-site";

const ADMIN_SHOP_COOKIE = "admin_barber_shop_id";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const shopId = requestUrl.searchParams.get("shopId");

  if (requestUrl.hostname.includes("smartsynk.net")) {
    const target = new URL("/api/admin/switch-barber-shop", BARBER_SITE.url);
    if (shopId) target.searchParams.set("shopId", shopId);
    return NextResponse.redirect(target);
  }

  const ok = await getIsSuperAdmin();
  if (!ok) return NextResponse.redirect(new URL("/dashboard", request.url));

  if (!shopId) return NextResponse.redirect(new URL("/admin/barber-shops", request.url));

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SHOP_COOKIE, shopId, { path: "/", maxAge: 60 * 60 * 24 * 7 });

  return NextResponse.redirect(new URL("/barber/dashboard", request.url));
}
