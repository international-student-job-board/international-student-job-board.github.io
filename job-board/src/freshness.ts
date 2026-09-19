// How fresh the board is, worked out from the roles themselves.
//
// The board is refreshed every day, and it says so - but only while the data agrees. The claim is
// derived, not typed: when the newest role is a few days old (a refresh was missed) the line says
// when it was last updated instead of saying "daily", so it can never promise what the data
// contradicts.

import { Job } from './types';
import { dateValue, daysBeforeISO, todayISO } from './format';

export interface Freshness {
  /** The newest posting date on the board, YYYY-MM-DD, or '' with no roles. */
  newest: string;
  /** Roles posted today or yesterday - what the Posted filter's "Last 24 hours" shows. */
  last24h: number;
  /** Roles posted within the last 7 days, the same way. */
  last7d: number;
  /** Whether the newest role is recent enough for "updated daily" to be true. */
  current: boolean;
}

/** A refresh missed for longer than this and the board stops calling itself daily. Dates carry no
 * time, so "yesterday's newest" on the morning after is normal; two days old is a missed run. */
const DAILY_GRACE_DAYS = 2;

const day = (job: Job): string => (job.posted || '').slice(0, 10);

export function freshness(jobs: Job[], today: string = todayISO()): Freshness {
  const since = (days: number) => dateValue(daysBeforeISO(today, days));
  const yesterday = since(1);
  const week = since(7);

  let newest = '';
  let last24h = 0;
  let last7d = 0;
  for (const job of jobs) {
    const posted = day(job);
    if (!posted) continue;
    if (posted > newest) newest = posted;
    const value = dateValue(posted);
    if (value >= yesterday) last24h += 1;
    if (value >= week) last7d += 1;
  }

  const current = Boolean(newest) && dateValue(newest) >= since(DAILY_GRACE_DAYS);
  return { newest, last24h, last7d, current };
}
