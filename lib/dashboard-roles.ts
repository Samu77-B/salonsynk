/** Owners, managers (custom roles), and super admins can access finance-style dashboard areas. */
export function canViewReports(isSuperAdmin: boolean, memberRole: string): boolean {
  const role = (memberRole ?? "").toLowerCase();
  return isSuperAdmin || role === "owner" || role.includes("manager");
}

/** True when member should have full manager access across the dashboard. */
export function isManagerRole(isSuperAdmin: boolean, memberRole: string): boolean {
  return canViewReports(isSuperAdmin, memberRole);
}

/**
 * Shared front-desk / “general salon” logins created in admin as role `staff` (non-manager).
 * They operate the diary daily — skip PIN-at-login and reschedule step-up PIN for diary moves only
 * (see patch-appointment + dashboard layout).
 */
export function isGeneralSalonStaffRole(memberRole: string | null | undefined): boolean {
  return (memberRole ?? "").trim().toLowerCase() === "staff";
}
