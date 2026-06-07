import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIsSuperAdmin } from "@core/supabase/admin-auth";

const ADMIN_SHOP_COOKIE = "admin_barber_shop_id";

export async function GET(request: Request) {
  const ok = await getIsSuperAdmin();
  if (!ok) return NextResponse.redirect(new URL("/dashboard", request.url));

  const { searchParams } = new URL(request.url);
  const shopId = searchParams.get("shopId");
  if (!shopId) return NextResponse.redirect(new URL("/admin/barber-shops", request.url));

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SHOP_COOKIE, shopId, { path: "/", maxAge: 60 * 60 * 24 * 7 });

  return NextResponse.redirect(new URL("/barber/dashboard", request.url));
}
