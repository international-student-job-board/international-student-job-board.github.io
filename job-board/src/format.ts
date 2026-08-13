// Milliseconds since the epoch for an ISO date, or NaN when the value is missing or
// unreadable.
export function dateValue(iso: string): number {
  return new Date(iso).getTime();
}

// Today as YYYY-MM-DD in the viewer's own timezone.
export function todayISO(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// Format an ISO date (YYYY-MM-DD) as "12 Feb 2026".
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** What a field reads as when a role doesn't carry it. */
export const NOT_SPECIFIED = 'Not specified';

export const orNotSpecified = (value: string) => value.trim() || NOT_SPECIFIED;

/** A role that starts as soon as someone is found. */
export const START_ASAP = 'asap';

export const isStartAsap = (value: string) =>
  value.trim().toLowerCase() === START_ASAP;

/** How a start date reads: a date, as soon as possible, or nothing said. */
export function formatStart(value: string): string {
  if (isStartAsap(value)) return 'As soon as possible';
  return value.trim() ? formatDate(value) : NOT_SPECIFIED;
}
