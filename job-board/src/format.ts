// Milliseconds since the epoch for an ISO date, or NaN when the value is
// missing or unreadable. Shared by the newest-first sort and the "posted
// within" filter so both agree on what a date is worth.
export function dateValue(iso: string): number {
  return new Date(iso).getTime();
}

// Today as YYYY-MM-DD in the viewer's own timezone. Built from the local
// calendar parts rather than by parsing: a date-only ISO string parses as UTC
// midnight, which is the previous day for anyone west of Greenwich and would
// retire a role a day early for them.
export function todayISO(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

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

/**
 * What a field reads as when a role doesn't carry it. Shown rather than left
 * blank so a gap in the data is legible as a gap, not as an oversight in the
 * page — and so the filters can offer it as something to search for.
 */
export const NOT_SPECIFIED = 'Not specified';

export const orNotSpecified = (value: string) => value.trim() || NOT_SPECIFIED;

/**
 * A role that starts as soon as someone is found. Stored in the start-date
 * field rather than beside it: "when does this start" has one answer, and two
 * fields could disagree — a date filled in with the ASAP box also ticked has
 * no obvious winner.
 */
export const START_ASAP = 'asap';

export const isStartAsap = (value: string) =>
  value.trim().toLowerCase() === START_ASAP;

/** How a start date reads: a date, as soon as possible, or nothing said. */
export function formatStart(value: string): string {
  if (isStartAsap(value)) return 'As soon as possible';
  return value.trim() ? formatDate(value) : NOT_SPECIFIED;
}
