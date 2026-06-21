/** Format minutes stored in the database for display, e.g. 130 → "2h 10 mins". */
export function formatDurationMinutes(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(Number(totalMinutes) || 0));
  if (minutes === 0) return "0 mins";

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    return mins === 1 ? "1 min" : `${mins} mins`;
  }
  if (mins === 0) {
    return hours === 1 ? "1h" : `${hours}h`;
  }

  const hPart = hours === 1 ? "1h" : `${hours}h`;
  const mPart = mins === 1 ? "1 min" : `${mins} mins`;
  return `${hPart} ${mPart}`;
}
