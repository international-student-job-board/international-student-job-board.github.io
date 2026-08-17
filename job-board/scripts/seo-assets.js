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

const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

/**
 * A real page for one address.
 *
 * GitHub Pages has no rewrites, so anything without a file of its own falls
 * through to 404.html — which is the app, so a person sees the site, but the
 * response carries a 404 and Google will not index a page that says "not
 * found". Every route therefore gets a file, and every file gets the title,
 * description, canonical and structured data for what is actually on it.
 *
 * The body is filled in too. The app replaces it the moment React mounts, but
 * until then it is what a crawler reads without running any JavaScript at all.
 */
function writePage(template, { path: urlPath, title, description, schema, body }) {
  const url = siteUrl + urlPath;
  const head = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(
      /(<meta name="description" content=")[^"]*(")/,
      `$1${esc(description)}$2`
    )
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${esc(url)}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(title)}$2`)
    .replace(
      /(<meta property="og:description" content=")[^"]*(")/,
      `$1${esc(description)}$2`
    )
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${esc(url)}$2`);

  const withSchema = schema
    ? head.replace(
        '</head>',
        `<script type="application/ld+json">${JSON.stringify(schema)}</script></head>`
      )
    : head;

  const html = body
    ? withSchema.replace('<div id="root"></div>', `<div id="root">${body}</div>`)
    : withSchema;

  const dir = path.join(outDir, urlPath.replace(/^\//, ''));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
}

/** The listing window, matched to MONTHS_LISTED in src/jobs.ts. */
function lapses(posted) {
  const date = new Date(`${posted}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  date.setUTCMonth(date.getUTCMonth() + MONTHS_LISTED);
  return date.toISOString().slice(0, 10);
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
    .map((cells) => ({
      id: at(cells, 'Job ID').trim(),
      title: at(cells, 'Job title').trim(),
      company: at(cells, 'Company name').trim(),
      tagline: at(cells, 'Tagline').trim(),
      type: at(cells, 'Job type').trim(),
      occupation: at(cells, 'ANZSCO occupation').trim(),
      city: at(cells, 'Job city').trim(),
      state: at(cells, 'State').trim(),
      country: at(cells, 'Job country').trim(),
      posted: at(cells, 'Date posted').trim(),
      url: at(cells, 'Job URL').trim(),
    }))
    .filter((job) => job.id && job.title && (!job.posted || job.posted >= oldest));
}

const escape = (value) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function main() {
  if (!fs.existsSync(outDir)) {
    console.error(`seo-assets: ${outDir} does not exist — run the build first`);
    process.exit(1);
  }

  // 1. The single-page fallback, for anything we haven't written a file for.
  const indexHtml = path.join(outDir, 'index.html');
  const template = fs.readFileSync(indexHtml, 'utf8');
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

  // 2a. A real file per address, so each answers 200 with its own title,
  //     description and structured data instead of falling through to 404.
  const SITE = 'International Student Job Board';
  [
    {
      path: '/companies',
      title: `Australian startups and scaleups hiring | ${SITE}`,
      description:
        'Australian startups and scaleups that are hiring, with their state, industry, size, stage and whether they are an accredited visa sponsor.',
    },
    {
      path: '/about',
      title: `About and visa resources | ${SITE}`,
      description:
        'How this board works, and the official Home Affairs and ABS sources behind its visa, occupation and skills-assessment information.',
    },
    {
      path: '/post',
      title: `Post a job | ${SITE}`,
      description:
        'List an Australian startup role for international students and graduates. Every role is checked by hand before it goes up.',
    },
  ].forEach((page) => writePage(template, page));

  jobs.forEach((job) => {
    const where = [job.city, job.country].filter(Boolean).join(', ');
    const description = [
      `${job.title} at ${job.company}${where ? ` in ${where}` : ''}.`,
      job.type ? `${job.type}.` : '',
      job.occupation ? `ANZSCO occupation: ${job.occupation}.` : '',
      'Visa pathways and skills assessment for international students and graduates.',
    ]
      .filter(Boolean)
      .join(' ');

    const validThrough = job.posted ? lapses(job.posted) : '';
    writePage(template, {
      path: `/jobs/${job.id}`,
      title: `${job.title} at ${job.company}${where ? ` - ${where}` : ''} | ${SITE}`,
      description,
      schema: {
        '@context': 'https://schema.org',
        '@type': 'JobPosting',
        title: job.title,
        description,
        identifier: { '@type': 'PropertyValue', name: SITE, value: job.id },
        ...(job.posted ? { datePosted: job.posted } : {}),
        ...(validThrough ? { validThrough } : {}),
        ...(job.type ? { employmentType: job.type } : {}),
        hiringOrganization: { '@type': 'Organization', name: job.company },
        jobLocation: {
          '@type': 'Place',
          address: {
            '@type': 'PostalAddress',
            ...(job.city ? { addressLocality: job.city } : {}),
            ...(job.state ? { addressRegion: job.state } : {}),
            addressCountry: 'AU',
          },
        },
        directApply: false,
        url: `${siteUrl}/jobs/${job.id}`,
      },
      body: [
        '<article>',
        `<h1>${esc(job.title)}</h1>`,
        `<p>${esc(job.company)}${job.tagline ? ` — ${esc(job.tagline)}` : ''}</p>`,
        `<p>${esc([where, job.type].filter(Boolean).join(' · '))}</p>`,
        job.occupation ? `<p>ANZSCO occupation: ${esc(job.occupation)}</p>` : '',
        job.posted ? `<p>Posted ${esc(job.posted)}</p>` : '',
        '</article>',
      ].join(''),
    });
  });

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

  console.log(
    `seo-assets: ${urls.length} pages written (${jobs.length} roles), plus 404.html, ` +
      `robots.txt and sitemap.xml -> ${target}`
  );
}

main();
