/** True when DB doesn't have processing_time_minutes yet (or schema cache still references it). */
export function isMissingProcessingColumnError(error: { message?: string } | null | undefined) {
  const msg = (error?.message ?? "").toLowerCase();
  return msg.includes("processing_time_minutes");
}
