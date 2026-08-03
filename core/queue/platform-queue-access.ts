import { isManagerRole } from "@core/auth/dashboard-roles";

export const QUEUE_SETUP_LIMITS = {
  maxServices: 20,
  maxTeamMembers: 10,
  maxStations: 10,
} as const;

export function hasQueueManagerAccess(
  isSuperAdmin: boolean,
  memberRole: string,
  memberId: string
): boolean {
  if (memberId === "admin") return true;
  return isManagerRole(isSuperAdmin, memberRole);
}

export function isValidStationNumber(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= QUEUE_SETUP_LIMITS.maxStations;
}

type StaffQueueRow = {
  preferred_staff_id?: string | null;
  assigned_staff_id?: string | null;
  status: string;
};

export function staffQueueRowVisibleToMember(
  row: StaffQueueRow,
  memberId: string,
  managerView: boolean
): boolean {
  if (managerView) return true;
  if (row.status === "in_chair") return row.assigned_staff_id === memberId;
  if (row.status === "waiting") return row.preferred_staff_id === memberId;
  return false;
}

export function assertCanStartQueueEntry(
  entry: { preferred_staff_id: string | null; status: string },
  staffId: string,
  managerView: boolean
): string | null {
  if (entry.status !== "waiting") return "Client is not waiting";
  if (managerView) return null;
  if (!entry.preferred_staff_id) return "Ask reception to assign this walk-in";
  if (entry.preferred_staff_id !== staffId) return "This client is waiting for someone else";
  return null;
}

export function assertCanManageInChairEntry(
  entry: { assigned_staff_id: string | null },
  staffId: string,
  managerView: boolean
): string | null {
  if (managerView) return null;
  if (entry.assigned_staff_id !== staffId) return "This client is with another team member";
  return null;
}

export function appointmentVisibleToMember(
  staffId: string | null | undefined,
  memberId: string,
  managerView: boolean
): boolean {
  if (managerView) return true;
  return staffId === memberId;
}
