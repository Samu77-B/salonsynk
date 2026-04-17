/** Owners, managers (custom roles), and super admins can access finance-style dashboard areas. */
export function canViewReports(isSuperAdmin: boolean, memberRole: string): boolean {
  const role = (memberRole ?? "").toLowerCase();
  return isSuperAdmin || role === "owner" || role.includes("manager");
}

/** True when member should have full manager access across the dashboard. */
export function isManagerRole(isSuperAdmin: boolean, memberRole: string): boolean {
  return canViewReports(isSuperAdmin, memberRole);
}
