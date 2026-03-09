"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";

const ADMIN_SALON_COOKIE = "admin_salon_id";

export async function switchAdminSalon(salonId: string) {
  const ok = await getIsSuperAdmin();
  if (!ok) return;
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SALON_COOKIE, salonId, { path: "/", maxAge: 60 * 60 * 24 * 7 }); // 7 days
  redirect("/dashboard");
}
