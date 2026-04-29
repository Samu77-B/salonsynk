/**
 * salon_members.show_on_diary === false hides the member from diary columns,
 * checkout stylist pickers, and public booking stylist lists (e.g. front desk login only).
 */
export function memberShowsOnDiary(row: { show_on_diary?: boolean | null }): boolean {
  return row.show_on_diary !== false;
}
