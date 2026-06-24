/** True when the nail_salons table does not exist yet. */
export function isMissingNailSalonsTableError(error: { message?: string } | null | undefined) {
  const msg = (error?.message ?? "").toLowerCase();
  return msg.includes("nail_salons") && (msg.includes("does not exist") || msg.includes("relation"));
}

/** True when the nail_queue table does not exist yet. */
export function isMissingNailQueueTableError(error: { message?: string } | null | undefined) {
  const msg = (error?.message ?? "").toLowerCase();
  return msg.includes("nail_queue") && (msg.includes("does not exist") || msg.includes("relation"));
}

/** True when the nail_appointments table does not exist yet. */
export function isMissingNailAppointmentsTableError(error: { message?: string } | null | undefined) {
  const msg = (error?.message ?? "").toLowerCase();
  return msg.includes("nail_appointments") && (msg.includes("does not exist") || msg.includes("relation"));
}

/** True when the nail_members table does not exist yet. */
export function isMissingNailMembersTableError(error: { message?: string } | null | undefined) {
  const msg = (error?.message ?? "").toLowerCase();
  return msg.includes("nail_members") && (msg.includes("does not exist") || msg.includes("relation"));
}
