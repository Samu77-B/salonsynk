/**
 * Barber module auth helpers.
 * Re-exports shared auth utilities; add barber-specific role logic here.
 */
export { canViewReports, isManagerRole } from "@core/auth/dashboard-roles";
export { hashPasscode, verifyPasscode } from "@core/auth/passcode";
