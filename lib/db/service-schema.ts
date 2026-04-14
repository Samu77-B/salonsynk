/** True when DB doesn't have processing_time_minutes yet (or schema cache still references it). */
export function isMissingProcessingColumnError(error: { message?: string } | null | undefined) {
  const msg = (error?.message ?? "").toLowerCase();
  return msg.includes("processing_time_minutes");
}

/** True when services.description column is not present yet. */
export function isMissingDescriptionColumnError(error: { message?: string } | null | undefined) {
  const msg = (error?.message ?? "").toLowerCase();
  return msg.includes("description") && (msg.includes("does not exist") || msg.includes("schema cache"));
}

/** True when services.color column is not present yet. */
export function isMissingColorColumnError(error: { message?: string } | null | undefined) {
  const msg = (error?.message ?? "").toLowerCase();
  return msg.includes("color") && (msg.includes("does not exist") || msg.includes("schema cache"));
}
