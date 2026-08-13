// Writes the two files a static host needs before a single-page app can be
// found in search, then a third that makes its URLs work at all.
//
//   node scripts/seo-assets.js <build-dir> [site-url]
//
// 1. 404.html — a copy of index.html. GitHub Pages has no server to route
//    /jobs/7 to the app, so it serves 404.html; making that the app is what
//    turns a fragment-based board into one with an address per role.
// 2. sitemap.xml — every role and page, so a crawler doesn't have to discover
//    1,000 URLs by following links from one page.
// 3. robots.txt — pointing at the sitemap, which is how a crawler finds it
//    without being told in Search Console.
//
// Roles older than the board's listing window are left out: a sitemap is a
// claim that a URL is worth indexing, and those have already stopped showing.

const fs = require('fs');
const path = require('path');
const { contentPath, DATA_FILES } = require('./data-files');

const MONTHS_LISTED = 2;

const target = process.argv[2];
const siteUrl = (process.argv[3] || 'https://international-student-job-board.github.io').replace(
  /\/$/,
  ''
);
if (!target) {
  console.error('seo-assets: a build directory is required (e.g. `build`)');
  process.exit(1);
}
const outDir = path.resolve(__dirname, '..', target);

/** Splits one CSV line, respecting quoted cells. */
function splitCsvLine(line) {
  const cells = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char !== '"') field += char;
      else if (line[i + 1] === '"') (field += '"'), (i += 1);
      else quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === ',') (cells.push(field), (field = ''));
    else field += char;
  }
  cells.push(field);
  return cells;
}

function readJobs() {
  const file = DATA_FILES.find((f) => f.url === '/jobs.csv');
  const source = contentPath(file.name);
  if (!fs.existsSync(source)) return [];

  const lines = fs.readFileSync(source, 'utf8').split(/\r?\n/).filter(Boolean);
  const header = splitCsvLine(lines[0]).map((c) => c.trim());
  const at = (cells, name) => cells[header.indexOf(name)] || '';

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - MONTHS_LISTED);
  const oldest = cutoff.toISOString().slice(0, 10);

  return lines
    .slice(1)
    .map(splitCsvLine)
    .map((cells) => ({ id: at(cells, 'Job ID').trim(), posted: at(cells, 'Date posted').trim() }))
    .filter((job) => job.id && (!job.posted || job.posted >= oldest));
}

const escape = (value) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function main() {
  if (!fs.existsSync(outDir)) {
    console.error(`seo-assets: ${outDir} does not exist — run the build first`);
    process.exit(1);
  }

  // 1. The single-page fallback.
  const indexHtml = path.join(outDir, 'index.html');
  fs.copyFileSync(indexHtml, path.join(outDir, '404.html'));

  // 2. The sitemap. Pages first, then roles; the board changes daily and a
  //    role only when it is re-listed, which is what changefreq says here.
  const jobs = readJobs();
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: '/', priority: '1.0', changefreq: 'daily' },
    { loc: '/companies', priority: '0.8', changefreq: 'weekly' },
    { loc: '/about', priority: '0.5', changefreq: 'monthly' },
    { loc: '/post', priority: '0.5', changefreq: 'monthly' },
    ...jobs.map((job) => ({
      loc: `/jobs/${encodeURIComponent(job.id)}`,
      lastmod: job.posted || today,
      priority: '0.7',
      changefreq: 'weekly',
    })),
  ];

  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((url) =>
      [
        '  <url>',
        `    <loc>${escape(siteUrl + url.loc)}</loc>`,
        `    <lastmod>${url.lastmod || today}</lastmod>`,
        `    <changefreq>${url.changefreq}</changefreq>`,
        `    <priority>${url.priority}</priority>`,
        '  </url>',
      ].join('\n')
    ),
    '</urlset>',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'sitemap.xml'), sitemap);

  // 3. robots.txt, pointing at it.
  fs.writeFileSync(
    path.join(outDir, 'robots.txt'),
    ['# https://www.robotstxt.org/robotstxt.html', 'User-agent: *', 'Allow: /', '', `Sitemap: ${siteUrl}/sitemap.xml`, ''].join('\n')
  );

  console.log(`seo-assets: 404.html, robots.txt and sitemap.xml (${urls.length} URLs) -> ${target}`);
}

main();
