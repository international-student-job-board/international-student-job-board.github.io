// Page views, sent by the app rather than by the tag.
//
// gtag('config') would send exactly one view, at load, and this is a single-page
// app - so the landing page would be the only page anything was ever recorded
// for. Automatic collection is switched off in index.html and every view is sent
// from here instead, on the same navigation that sets the title and canonical.

import { PageMeta } from './seo';
import { FilterState } from './components/Filters';
import { Job } from './types';

type Gtag = (command: string, ...args: unknown[]) => void;

declare global {
  interface Window {
    gtag?: Gtag;
  }
}

/**
 * One page view, for an address the app has just navigated to.
 *
 * A no-op when gtag isn't there, which is every test run, every local build and
 * any visit where the script was blocked. Analytics failing should never be
 * something the page notices.
 */
export function trackPageView({ title, url }: PageMeta): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag('event', 'page_view', {
    page_title: title,
    page_location: url,
    page_path: new URL(url, window.location.href).pathname,
  });
}

/** Event parameters GA4 accepts: strings and numbers, kept short. */
export type EventParams = Record<string, string | number | boolean | undefined>;

/**
 * One event. A no-op wherever the tag isn't (see trackPageView), so calling it costs nothing and
 * can't fail a page.
 *
 * Parameters are the things worth asking of the data later - which filter, which kind of role,
 * whether the employer sponsors - and never anything that identifies a person.
 */
export function trackEvent(name: string, params: EventParams = {}): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag('event', name, params);
}

const shorten = (value: string, max = 100): string =>
  value.length > max ? `${value.slice(0, max - 1)}\u2026` : value;

const sponsorOf = (job: Job): string => {
  const sponsor = job.company.accreditedSponsor;
  return sponsor === true ? 'yes' : sponsor === false ? 'no' : 'unknown';
};

/** What a role is, for the events about it - which roles get opened and applied to. */
export function jobParams(job: Job): EventParams {
  return {
    job_id: job.id,
    company: shorten(job.company.name),
    job_type: job.type || 'unspecified',
    job_location: job.location || 'unspecified',
    sponsor: sponsorOf(job),
  };
}

/** A role opened from the list. */
export const trackRoleOpen = (job: Job): void => trackEvent('role_open', jobParams(job));

/** The apply button pressed - the closest thing this site has to a conversion. */
export const trackApply = (job: Job, method: 'site' | 'email'): void =>
  trackEvent('apply_click', { ...jobParams(job), method });

/** One filter value added or removed. */
export interface FilterChange {
  name: string;
  value: string;
  action: 'add' | 'remove';
}

const SCALARS = ['postedWithinDays', 'salaryMin', 'salaryMax', 'minRating'] as const;

/**
 * What changed between two sets of filters, one entry per value added or removed. The search box is
 * left out - it is reported as a search, once the reader stops typing - and so is anything the board
 * set for itself, since only handlers that respond to the reader call this.
 */
export function changedFilters(prev: FilterState, next: FilterState): FilterChange[] {
  const changes: FilterChange[] = [];
  for (const key of Object.keys(next) as (keyof FilterState)[]) {
    const before = prev[key];
    const after = next[key];
    if (Array.isArray(before) && Array.isArray(after)) {
      for (const value of after) {
        if (!before.includes(value))
          changes.push({ name: key, value: value || '(blank)', action: 'add' });
      }
      for (const value of before) {
        if (!after.includes(value)) {
          changes.push({ name: key, value: value || '(blank)', action: 'remove' });
        }
      }
    } else if ((SCALARS as readonly string[]).includes(key) && before !== after) {
      changes.push({
        name: key,
        value: String(after),
        action: after ? 'add' : 'remove',
      });
    }
  }
  return changes;
}

/** Reports every filter the reader just changed. */
export function trackFilterChange(prev: FilterState, next: FilterState): void {
  for (const change of changedFilters(prev, next)) {
    trackEvent('filter_change', {
      filter_name: change.name,
      filter_value: shorten(change.value),
      action: change.action,
    });
  }
}
