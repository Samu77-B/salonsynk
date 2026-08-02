import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getIsSuperAdmin } from "@core/supabase/admin-auth";
import { BARBER_SITE } from "@core/config/barber-site";
import {
  sanitizeAdminSwitchNext,
  smartLoginUrlForAdminReturn,
} from "@core/auth/admin-switch-next";
import { userIsActiveTenantMember } from "@core/auth/tenant-membership";

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
    return NextResponse.redirect(smartLoginUrlForAdminReturn(requestUrl.toString()));
  }

  if (!shopId) return NextResponse.redirect(new URL("/barber/dashboard", request.url));

  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) {
    const member = await userIsActiveTenantMember(user.id, "barber", shopId);
    if (!member) return NextResponse.redirect(new URL("/barber/dashboard", request.url));
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SHOP_COOKIE, shopId, { path: "/", maxAge: 60 * 60 * 24 * 7 });

  return NextResponse.redirect(new URL(next, request.url));
}
