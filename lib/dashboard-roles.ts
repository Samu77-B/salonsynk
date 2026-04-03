/** Owners, managers (custom roles), and super admins can access finance-style dashboard areas. */
export function canViewReports(isSuperAdmin: boolean, memberRole: string): boolean {
  const role = (memberRole ?? "").toLowerCase();
  return isSuperAdmin || role === "owner" || role.includes("manager");
}
