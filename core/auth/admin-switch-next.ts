/** Safe relative path for post-switch redirects (blocks open redirects). */
export function sanitizeAdminSwitchNext(
  next: string | null | undefined,
  fallback: string
): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}
