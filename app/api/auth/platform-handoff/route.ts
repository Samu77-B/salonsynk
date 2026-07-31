import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getIsSuperAdmin } from "@core/supabase/admin-auth";
import { getAuthCallbackUrl } from "@core/auth/auth-redirect";
import {
  isAllowedAdminReturnUrl,
  platformFromAdminReturnUrl,
  smartLoginUrlForAdminReturn,
} from "@core/auth/admin-switch-next";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const returnTo = requestUrl.searchParams.get("returnTo");

  if (!returnTo || !isAllowedAdminReturnUrl(returnTo)) {
    return NextResponse.redirect(new URL("/smart/overview", request.url));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.redirect(smartLoginUrlForAdminReturn(returnTo));
  }

  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) {
    return NextResponse.redirect(new URL("/smart/overview", request.url));
  }

  const target = new URL(returnTo);
  const returnPath = `${target.pathname}${target.search}`;
  const platform = platformFromAdminReturnUrl(returnTo);
  const callbackUrl = new URL(getAuthCallbackUrl(platform));
  callbackUrl.searchParams.set("next", returnPath);

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
    options: { redirectTo: callbackUrl.toString() },
  });

  const actionLink = data?.properties?.action_link;
  if (error || !actionLink) {
    console.error("platform-handoff generateLink failed:", error);
    return NextResponse.redirect(new URL("/smart/overview", request.url));
  }

  return NextResponse.redirect(actionLink);
}
