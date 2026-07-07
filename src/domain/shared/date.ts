// Local calendar date (not UTC) — matches the user's intuitive notion of "today"
// for grouping a day's clips into one project, even near midnight.
export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
