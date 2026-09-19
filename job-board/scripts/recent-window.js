// Which roles count as "the last 3 days", for the pre-loaded snapshot.
//
// Kept apart from seo-assets.js so it is a pure function a test can call. That
// script does its work at load time; this one only does arithmetic on dates.
//
// The window ends on the newest posting date in the data, not on today's date.
// The board is rebuilt when the data is refreshed, not every day, so a window
// anchored to the wall clock would shrink the longer the data sat - and empty
// out entirely a few days after the last refresh, leaving the landing page with
// nothing "new" to show. Anchored to the data, it always holds the newest three
// days there are, and the page states the dates so it never overclaims.

const RECENT_DAYS = 3;

/**
 * More than this is more markup and more bytes to parse before first paint than
 * a "what's new" list is worth; the full board is a click away either way.
 */
const MAX_RECENT = 300;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The date `days` before an ISO date, as an ISO date. Done in UTC so a DST change can't skip one. */
function daysBefore(iso, days) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) - days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * The newest `days` calendar days of roles.
 *
 * @param {{posted: string}[]} jobs Any order. `posted` is a YYYY-MM-DD date, or blank.
 * @param {string} today YYYY-MM-DD. A role dated after it is a data error, and is ignored
 *   rather than allowed to drag the window into the future.
 * @returns {{from: string, to: string, jobs: object[]}} `jobs` newest first, capped at
 *   MAX_RECENT; `from`/`to` are blank when nothing is dated.
 */
function recentWindow(jobs, today, days = RECENT_DAYS) {
  const dated = jobs.filter((job) => ISO_DATE.test(job.posted) && job.posted <= today);
  if (!dated.length) return { from: '', to: '', jobs: [] };

  const to = dated.reduce((newest, job) => (job.posted > newest ? job.posted : newest), '');
  // Inclusive: three days ending on the 17th are the 15th, 16th and 17th.
  const from = daysBefore(to, days - 1);

  return {
    from,
    to,
    jobs: dated
      .filter((job) => job.posted >= from)
      .sort((a, b) => b.posted.localeCompare(a.posted))
      .slice(0, MAX_RECENT),
  };
}

module.exports = { recentWindow, RECENT_DAYS, MAX_RECENT };
