import { createAdminClient } from "@/lib/supabase/admin";
import { SITE } from "@core/config/site";
import { BARBER_SITE } from "@core/config/barber-site";
import { NAIL_SITE } from "@core/config/nail-site";

export type PlatformMembership = {
  platform: "salon" | "barber" | "nail";
  tenantId: string;
  tenantName: string;
  role: string;
  dashboardUrl: string;
};

export type UserPlatformResolution = {
  type: "super_admin" | "salon" | "barber" | "nail" | "multi" | "none";
  isSuperAdmin: boolean;
  memberships: PlatformMembership[];
  defaultRedirect?: string;
};

const PLATFORM_URLS = {
  salon: SITE.url,
  barber: BARBER_SITE.url,
  nail: NAIL_SITE.url,
} as const;

const DASHBOARD_PATHS = {
  salon: "/dashboard",
  barber: "/barber/dashboard",
  nail: "/nail/queue",
} as const;

export async function resolveUserPlatform(userId: string): Promise<UserPlatformResolution> {
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", userId)
    .single();

  const isSuperAdmin = profile?.is_super_admin === true;

  if (isSuperAdmin) {
    return {
      type: "super_admin",
      isSuperAdmin: true,
      memberships: [],
      defaultRedirect: "/smart/overview",
    };
  }

  const memberships: PlatformMembership[] = [];

  const [salonMembers, barberMembers, nailMembers] = await Promise.all([
    admin
      .from("salon_members")
      .select("salon_id, role")
      .eq("user_id", userId)
      .eq("is_active", true),
    admin
      .from("barber_members")
      .select("shop_id, role")
      .eq("user_id", userId)
      .eq("is_active", true),
    admin
      .from("nail_members")
      .select("salon_id, role")
      .eq("user_id", userId)
      .eq("is_active", true),
  ]);

  const salonIds = (salonMembers.data ?? []).map((m) => m.salon_id);
  const shopIds = (barberMembers.data ?? []).map((m) => m.shop_id);
  const nailSalonIds = (nailMembers.data ?? []).map((m) => m.salon_id);

  const [salons, shops, nailSalons] = await Promise.all([
    salonIds.length
      ? admin.from("salons").select("id, name").in("id", salonIds)
      : Promise.resolve({ data: [] }),
    shopIds.length
      ? admin.from("barber_shops").select("id, name").in("id", shopIds)
      : Promise.resolve({ data: [] }),
    nailSalonIds.length
      ? admin.from("nail_salons").select("id, name").in("id", nailSalonIds)
      : Promise.resolve({ data: [] }),
  ]);

  const salonMap = new Map((salons.data ?? []).map((s) => [s.id, s.name]));
  const shopMap = new Map((shops.data ?? []).map((s) => [s.id, s.name]));
  const nailMap = new Map((nailSalons.data ?? []).map((s) => [s.id, s.name]));

  for (const m of salonMembers.data ?? []) {
    const name = salonMap.get(m.salon_id);
    if (name) {
      memberships.push({
        platform: "salon",
        tenantId: m.salon_id,
        tenantName: name,
        role: m.role ?? "staff",
        dashboardUrl: `${PLATFORM_URLS.salon}${DASHBOARD_PATHS.salon}`,
      });
    }
  }

  for (const m of barberMembers.data ?? []) {
    const name = shopMap.get(m.shop_id);
    if (name) {
      memberships.push({
        platform: "barber",
        tenantId: m.shop_id,
        tenantName: name,
        role: m.role ?? "staff",
        dashboardUrl: `${PLATFORM_URLS.barber}${DASHBOARD_PATHS.barber}`,
      });
    }
  }

  for (const m of nailMembers.data ?? []) {
    const name = nailMap.get(m.salon_id);
    if (name) {
      memberships.push({
        platform: "nail",
        tenantId: m.salon_id,
        tenantName: name,
        role: m.role ?? "staff",
        dashboardUrl: `${PLATFORM_URLS.nail}${DASHBOARD_PATHS.nail}`,
      });
    }
  }

  if (memberships.length === 0) {
    return { type: "none", isSuperAdmin: false, memberships: [] };
  }

  if (memberships.length === 1) {
    const m = memberships[0];
    return {
      type: m.platform,
      isSuperAdmin: false,
      memberships,
      defaultRedirect: m.dashboardUrl,
    };
  }

  return {
    type: "multi",
    isSuperAdmin: false,
    memberships,
  };
}

export function getPlatformCallbackUrl(platform: "salon" | "barber" | "nail"): string {
  const base = PLATFORM_URLS[platform];
  const next = DASHBOARD_PATHS[platform];
  return `${base}/auth/callback?next=${encodeURIComponent(next)}`;
}
