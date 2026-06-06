/** True when the barber_shops table does not exist yet. */
export function isMissingBarberShopsTableError(error: { message?: string } | null | undefined) {
  const msg = (error?.message ?? "").toLowerCase();
  return msg.includes("barber_shops") && (msg.includes("does not exist") || msg.includes("relation"));
}

/** True when the barber_queue table does not exist yet. */
export function isMissingBarberQueueTableError(error: { message?: string } | null | undefined) {
  const msg = (error?.message ?? "").toLowerCase();
  return msg.includes("barber_queue") && (msg.includes("does not exist") || msg.includes("relation"));
}

/** True when the barber_appointments table does not exist yet. */
export function isMissingBarberAppointmentsTableError(error: { message?: string } | null | undefined) {
  const msg = (error?.message ?? "").toLowerCase();
  return msg.includes("barber_appointments") && (msg.includes("does not exist") || msg.includes("relation"));
}

/** True when the barber_members table does not exist yet. */
export function isMissingBarberMembersTableError(error: { message?: string } | null | undefined) {
  const msg = (error?.message ?? "").toLowerCase();
  return msg.includes("barber_members") && (msg.includes("does not exist") || msg.includes("relation"));
}
