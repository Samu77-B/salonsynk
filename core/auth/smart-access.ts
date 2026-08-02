import {
  resolveUserPlatform,
  type PlatformMembership,
  type UserPlatformResolution,
} from "@core/auth/resolve-user-platform";

const OWNER_ROLES = new Set(["owner"]);

export function isOwnerMembership(m: PlatformMembership): boolean {
  return OWNER_ROLES.has((m.role ?? "").toLowerCase());
}

/** Locations the user owns (any Synk product). */
export function ownerMemberships(resolution: UserPlatformResolution): PlatformMembership[] {
  return resolution.memberships.filter(isOwnerMembership);
}

/**
 * SmartSynk dashboard access: platform super-admins, or owners of 2+ locations
 * (multi-salon / multi-platform groups).
 */
export function qualifiesForOwnerHub(resolution: UserPlatformResolution): boolean {
  if (resolution.isSuperAdmin) return true;
  return ownerMemberships(resolution).length >= 2;
}

export async function getSmartAccess(userId: string): Promise<{
  canAccess: boolean;
  isSuperAdmin: boolean;
  resolution: UserPlatformResolution;
  ownedLocations: PlatformMembership[];
}> {
  const resolution = await resolveUserPlatform(userId);
  const ownedLocations = ownerMemberships(resolution);
  return {
    canAccess: qualifiesForOwnerHub(resolution),
    isSuperAdmin: resolution.isSuperAdmin,
    resolution,
    ownedLocations,
  };
}

export function tenantIdsByPlatform(memberships: PlatformMembership[]): {
  salonIds: string[];
  shopIds: string[];
  nailSalonIds: string[];
} {
  const salonIds: string[] = [];
  const shopIds: string[] = [];
  const nailSalonIds: string[] = [];
  for (const m of memberships) {
    if (m.platform === "salon") salonIds.push(m.tenantId);
    else if (m.platform === "barber") shopIds.push(m.tenantId);
    else if (m.platform === "nail") nailSalonIds.push(m.tenantId);
  }
  return { salonIds, shopIds, nailSalonIds };
}
