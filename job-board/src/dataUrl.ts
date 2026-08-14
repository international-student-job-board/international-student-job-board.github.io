// The URL for a data file, stamped with the build it belongs to.
//
// The bundle and the stylesheet carry a content hash in their filenames, so a
// deploy gives them new URLs and a browser can never serve a stale one. The data
// files don't: /jobs.csv is /jobs.csv forever, and GitHub Pages sends
// `cache-control: max-age=600` with it. Without a stamp, someone who visited in
// the last ten minutes keeps the old board after a deploy — and there is no way
// for them to know, because the page looks fine.
//
// The stamp is set once per build, so the file is still cached between visits.
// It only changes when there is something new to fetch.

const BUILD = process.env.REACT_APP_BUILD_ID || '';

/** "/jobs.csv" -> "/jobs.csv?v=1786…", or unchanged when nothing set it. */
export function dataUrl(path: string): string {
  const base = `${process.env.PUBLIC_URL || ''}${path}`;
  return BUILD ? `${base}?v=${encodeURIComponent(BUILD)}` : base;
}
