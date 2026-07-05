// Format an ISO date (YYYY-MM-DD) as "12 Feb 2026". Falls back to the raw
// string if it isn't a valid date, so bad CSV data never crashes the UI.
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
