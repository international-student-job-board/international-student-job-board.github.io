// Stamped at build time by the `build:pages` / `build` npm scripts (`date +%Y-%m-%d`); falls
// back to a fixed date during local dev where the env var isn't set. This is when the site's
// data was actually regenerated, as opposed to the newest job's posted date (see freshness.ts),
// which can lag behind it when no new roles happened to appear in that run.
export const BUILD_DATE = process.env.REACT_APP_BUILD_DATE || '2026-08-10';
