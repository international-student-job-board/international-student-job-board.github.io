// Page views, sent by the app rather than by the tag.
//
// gtag('config') would send exactly one view, at load, and this is a single-page
// app — so the landing page would be the only page anything was ever recorded
// for. Automatic collection is switched off in index.html and every view is sent
// from here instead, on the same navigation that sets the title and canonical.

import { PageMeta } from './seo';

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
