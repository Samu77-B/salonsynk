import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildPlatformAuthLink, getAuthCallbackUrl } from "@core/auth/auth-redirect";
import { getSmartAccess, isOwnerMembership } from "@core/auth/smart-access";
import {
  barberAdminSwitchUrl,
  nailAdminSwitchUrl,
  salonAdminSwitchUrl,
} from "@core/config/platform-urls";

/**
 * Multi-location owners on SmartSynk open a product location via magic link
 * → product auth callback → switch route (membership-verified) → dashboard.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const platform = requestUrl.searchParams.get("platform");
  const tenantId = requestUrl.searchParams.get("tenantId");

  if (
    (platform !== "salon" && platform !== "barber" && platform !== "nail") ||
    !tenantId
  ) {
    return NextResponse.json({ error: "Invalid location" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const access = await getSmartAccess(user.id);
  if (!access.canAccess && !access.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const owned = access.ownedLocations.find(
    (m) => m.platform === platform && m.tenantId === tenantId && isOwnerMembership(m)
  );

  if (!owned && !access.isSuperAdmin) {
    return NextResponse.json({ error: "You do not own this location" }, { status: 403 });
  }

  if (access.isSuperAdmin && !owned) {
    // Super admins can open any location via existing admin switch URLs.
    const url =
      platform === "salon"
        ? salonAdminSwitchUrl(tenantId)
        : platform === "barber"
          ? barberAdminSwitchUrl(tenantId)
          : nailAdminSwitchUrl(tenantId);
    return NextResponse.json({ url });
  }

  const switchPath =
    platform === "salon"
      ? `/api/admin/switch-salon?salonId=${encodeURIComponent(tenantId)}`
      : platform === "barber"
        ? `/api/admin/switch-barber-shop?shopId=${encodeURIComponent(tenantId)}`
        : `/api/admin/switch-nail-salon?salonId=${encodeURIComponent(tenantId)}`;

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
    options: { redirectTo: getAuthCallbackUrl(platform) },
  });

  if (error) {
    console.error("owner-location-handoff generateLink failed:", error);
    return NextResponse.json({ error: "Could not open location" }, { status: 500 });
  }

  const baseLink = buildPlatformAuthLink(data, platform, "magiclink");
  if (!baseLink) {
    return NextResponse.json({ error: "Could not open location" }, { status: 500 });
  }

  const url = new URL(baseLink);
  url.searchParams.set("next", switchPath);
  return NextResponse.json({ url: url.toString() });
}
