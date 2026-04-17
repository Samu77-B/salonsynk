import { cookies } from "next/headers";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { isManagerRole } from "@/lib/dashboard-roles";
import { verifyStaffElevationToken } from "@/lib/passcode";

export const STAFF_ELEVATION_COOKIE = "staff_elevated";

/**
 * Returns null when ok, otherwise an error string.
 * - Managers/superadmins never require elevation.
 * - Staff must have a valid `staff_elevated` cookie for the current salon.
 */
export async function requireStaffElevationOrError(opts: {
  salonId: string;
  memberRole: string | null | undefined;
}): Promise<string | null> {
  const isSuperAdmin = await getIsSuperAdmin();
  if (isManagerRole(isSuperAdmin, opts.memberRole ?? "")) return null;

  const jar = await cookies();
  const token = jar.get(STAFF_ELEVATION_COOKIE)?.value;
  if (!token) return "PIN_REQUIRED";
  const session = verifyStaffElevationToken(token);
  if (!session) return "PIN_REQUIRED";
  if (session.salonId !== opts.salonId) return "PIN_REQUIRED";
  return null;
}

