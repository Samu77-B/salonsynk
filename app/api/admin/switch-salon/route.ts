import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";

const ADMIN_SALON_COOKIE = "admin_salon_id";

export async function GET(request: Request) {
  const ok = await getIsSuperAdmin();
  if (!ok) return NextResponse.redirect(new URL("/dashboard", request.url));

  const { searchParams } = new URL(request.url);
  const salonId = searchParams.get("salonId");
  if (!salonId) return NextResponse.redirect(new URL("/admin/salons", request.url));

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SALON_COOKIE, salonId, { path: "/", maxAge: 60 * 60 * 24 * 7 });
  return NextResponse.redirect(new URL("/dashboard", request.url));
}
