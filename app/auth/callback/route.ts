import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const isSuperAdmin = await getIsSuperAdmin();
      const redirectTo = isSuperAdmin ? "/admin" : next;
      return NextResponse.redirect(`${origin}${redirectTo}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
