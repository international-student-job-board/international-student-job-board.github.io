// Writes the two files a static host needs before a single-page app can be
// found in search, then a third that makes its URLs work at all.
//
//   node scripts/seo-assets.js <build-dir> [site-url]
//
// 1. 404.html - a copy of index.html. GitHub Pages has no server to route
//    /jobs/7 to the app, so it serves 404.html; making that the app is what
//    turns a fragment-based board into one with an address per role.
// 2. sitemap.xml - every role and page, so a crawler doesn't have to discover
//    1,000 URLs by following links from one page.
// 3. robots.txt - pointing at the sitemap, which is how a crawler finds it
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

/** Our label -> the schema.org JobPosting employmentType token. */
const EMPLOYMENT_SCHEMA = {
  'Full-time': 'FULL_TIME',
  'Part-time': 'PART_TIME',
  Contract: 'CONTRACTOR',
  Casual: 'PART_TIME',
  Freelance: 'CONTRACTOR',
  Internship: 'INTERN',
};

const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

/**
 * A real page for one address.
 *
 * GitHub Pages has no rewrites, so anything without a file of its own falls
 * through to 404.html - which is the app, so a person sees the site, but the
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

  // .preboot is styled inline in the template's <head> - see public/index.html -
  // so this reads as a lightweight version of the page rather than raw HTML for
  // the moment before React mounts and replaces it.
  const html = body
    ? withSchema.replace('<div id="root"></div>', `<div id="root"><div class="preboot">${body}</div></div>`)
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

/** "120000" / "158000" -> "A$120k-A$158k"; a single figure, or blank. */
function moneyAud(min, max, estimate) {
  const k = (n) => {
    const v = Math.round(Number(n));
    if (!Number.isFinite(v) || v <= 0) return '';
    return v >= 10000 ? `A$${Math.round(v / 1000)}k` : `A$${v.toLocaleString('en-AU')}`;
  };
  const lo = k(min);
  const hi = k(max);
  if (lo && hi) return lo === hi ? lo : `${lo}-${hi}`;
  return lo || hi || k(estimate);
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
    .map((cells) => {
      const advertPosted = at(cells, 'Advert posted').trim();
      const datePosted = at(cells, 'Date posted').trim();
      return {
        id: at(cells, 'Job ID').trim(),
        title: at(cells, 'Job title').trim(),
        company: at(cells, 'Company name').trim(),
        tagline: at(cells, 'Tagline').trim(),
        type: at(cells, 'Job type').trim(),
        occupation: at(cells, 'ANZSCO occupation').trim(),
        city: at(cells, 'Job city').trim(),
        state: at(cells, 'State').trim(),
        country: at(cells, 'Job country').trim(),
        posted: advertPosted || datePosted,
        employmentType: at(cells, 'Employment type').trim(),
        level: at(cells, 'Job level').trim(),
        arrangement: at(cells, 'Work arrangement').trim(),
        education: at(cells, 'Education level').trim(),
        salaryMinAud: Math.round(Number(at(cells, 'Base salary min AUD'))) || 0,
        salaryMaxAud: Math.round(Number(at(cells, 'Base salary max AUD'))) || 0,
        salary: moneyAud(
          at(cells, 'Base salary min AUD'),
          at(cells, 'Base salary max AUD'),
          at(cells, 'Company salary estimate AUD')
        ),
        url: at(cells, 'Job URL').trim(),
      };
    })
    .filter((job) => job.id && job.title && (!job.posted || job.posted >= oldest))
    .sort((a, b) => (b.posted || '').localeCompare(a.posted || ''));
}

function readCompanies() {
  const file = DATA_FILES.find((f) => f.url === '/companies.csv');
  const source = contentPath(file.name);
  if (!fs.existsSync(source)) return [];

  const lines = fs.readFileSync(source, 'utf8').split(/\r?\n/).filter(Boolean);
  const header = splitCsvLine(lines[0]).map((c) => c.trim());
  const at = (cells, name) => cells[header.indexOf(name)] || '';

  return lines
    .slice(1)
    .map(splitCsvLine)
    .map((cells) => ({
      name: at(cells, 'Company name').trim(),
      tagline: at(cells, 'Tagline').trim(),
      state: at(cells, 'State').trim(),
      industries: at(cells, 'Industries').trim(),
      openings: Number(at(cells, 'Job openings')) || 0,
    }))
    .filter((c) => c.name);
}

const escape = (value) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function main() {
  if (!fs.existsSync(outDir)) {
    console.error(`seo-assets: ${outDir} does not exist - run the build first`);
    process.exit(1);
  }

  // 1. The single-page fallback, for anything we haven't written a file for.
  //    The template is the app shell with an empty #root - normalised here so a
  //    re-run (which rewrites index.html with the landing content) still starts
  //    from a blank body rather than baking one page's content into the rest.
  const indexHtml = path.join(outDir, 'index.html');
  const template = fs
    .readFileSync(indexHtml, 'utf8')
    .replace(/(<div id="root">)[\s\S]*?(<\/div>\s*<\/body>)/, '$1$2');
  fs.writeFileSync(path.join(outDir, '404.html'), template);

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
  //     description and structured data instead of falling through to 404 - and
  //     with real, linked content in the body, because a crawler (and some never
  //     run the app) has to be able to read the page and walk from it to every
  //     role without JavaScript. The app replaces all of this on mount.
  const SITE = 'International Student Job Board';
  const companies = readCompanies();

  const nav =
    '<nav aria-label="Site"><a href="/">All roles</a> · ' +
    '<a href="/companies">Companies</a> · ' +
    '<a href="/about">About &amp; visa resources</a> · ' +
    '<a href="/post">Post a job</a></nav>';

  /** One role as a list item - the same shape everywhere it is linked. */
  const jobLink = (job) => {
    const bits = [job.company, job.city, job.type, job.salary].filter(Boolean).join(' · ');
    return `<li><a href="/jobs/${esc(job.id)}">${esc(job.title)}</a>${
      bits ? ` - ${esc(bits)}` : ''
    }</li>`;
  };

  writePage(template, {
    path: '/companies',
    title: `Australian startups and scaleups hiring | ${SITE}`,
    description:
      'Australian startups and scaleups that are hiring, with their state, industry, size, stage and whether they are an accredited visa sponsor.',
    body: [
      '<main>',
      '<h1>Australian startups and scaleups hiring</h1>',
      `<p>${esc(
        `${companies.length.toLocaleString('en-AU')} companies founded in Australia, ` +
          'with their state, industry, stage and whether they sponsor visas. ' +
          'Use the board for the full list with filters and a map.'
      )}</p>`,
      nav,
      '<h2>Companies with roles open now</h2>',
      '<ul>',
      ...companies
        .filter((c) => c.openings > 0)
        .sort((a, b) => b.openings - a.openings)
        .slice(0, 400)
        .map(
          (c) =>
            `<li>${esc(c.name)}${
              c.state ? ` - ${esc(c.state)}` : ''
            }${c.industries ? ` · ${esc(c.industries.split(';')[0].trim())}` : ''} · ${
              c.openings
            } open ${c.openings === 1 ? 'role' : 'roles'}</li>`
        ),
      '</ul>',
      '</main>',
    ].join(''),
  });

  [
    {
      path: '/about',
      title: `About and visa resources | ${SITE}`,
      description:
        'How this board works, and the official Home Affairs and ABS sources behind its visa, occupation and skills-assessment information.',
      body: `<main><h1>About this board</h1><p>${esc(
        'A curated board of startup and scaleup roles across Australia for international ' +
          'students and graduates. Every role is checked by hand, and shows the visa ' +
          'pathways, ANZSCO occupation and skills assessment that apply, drawn from ' +
          'official Home Affairs and ABS sources.'
      )}</p>${nav}</main>`,
    },
    {
      path: '/post',
      title: `Post a job | ${SITE}`,
      description:
        'List an Australian startup role for international students and graduates. Every role is checked by hand before it goes up.',
      body: `<main><h1>Post a job</h1><p>${esc(
        'List an Australian startup or scaleup role for international students and ' +
          'graduates. Every role is checked by hand before it goes up.'
      )}</p>${nav}</main>`,
    },
  ].forEach((page) => writePage(template, page));

  jobs.forEach((job, i) => {
    const where = [job.city, job.country].filter(Boolean).join(', ');
    const description = [
      `${job.title} at ${job.company}${where ? ` in ${where}` : ''}.`,
      job.type ? `${job.type}.` : '',
      job.salary ? `Pay around ${job.salary} (AUD).` : '',
      job.occupation ? `ANZSCO occupation: ${job.occupation}.` : '',
      'Visa pathways and skills assessment for international students and graduates.',
    ]
      .filter(Boolean)
      .join(' ');

    // A dozen other current roles, so a crawler reaching any one role can walk
    // to the rest; wrapping the list keeps every role linked from ~12 others.
    const related = [];
    for (let k = 1; related.length < 12 && k < jobs.length; k += 1) {
      related.push(jobs[(i + k) % jobs.length]);
    }

    const facts = [
      ['Employment type', job.employmentType],
      ['Job level', job.level],
      ['Work arrangement', job.arrangement],
      ['Salary', job.salary && `${job.salary} (AUD, estimated where the ad doesn't state one)`],
      ['Education', job.education && job.education.replace(/;\s*/g, ', ')],
      ['ANZSCO occupation', job.occupation],
      ['Location', [job.city, job.state, job.country].filter(Boolean).join(', ')],
      ['Posted', job.posted],
    ].filter(([, v]) => v);

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
        ...(EMPLOYMENT_SCHEMA[job.employmentType]
          ? { employmentType: EMPLOYMENT_SCHEMA[job.employmentType] }
          : {}),
        // Google's job search only surfaces "work from home" results for roles marked
        // this way - a hybrid role still requires attending the jobLocation, so it's
        // left as a normal on-site posting.
        ...(job.arrangement === 'Remote' ? { jobLocationType: 'TELECOMMUTE' } : {}),
        ...(job.salaryMinAud || job.salaryMaxAud
          ? {
              baseSalary: {
                '@type': 'MonetaryAmount',
                currency: 'AUD',
                value: {
                  '@type': 'QuantitativeValue',
                  ...(job.salaryMinAud ? { minValue: job.salaryMinAud } : {}),
                  ...(job.salaryMaxAud ? { maxValue: job.salaryMaxAud } : {}),
                  unitText: 'YEAR',
                },
              },
            }
          : {}),
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
        `<p>${esc(job.company)}${job.tagline ? ` - ${esc(job.tagline)}` : ''}</p>`,
        '<dl>',
        ...facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`),
        '</dl>',
        `<p>${esc(
          `This role is on the board with the visa pathways, ANZSCO unit group and ` +
            `skills-assessment body that apply to ${job.occupation || 'the occupation'}, ` +
            `plus whether ${job.company} is an accredited sponsor.`
        )}</p>`,
        '</article>',
        '<section aria-label="More roles"><h2>More roles at Australian startups</h2><ul>',
        ...related.map(jobLink),
        '</ul></section>',
        nav,
      ].join(''),
    });
  });

  // 2b. The landing page itself - the most linked page on the site and, until
  //     now, an empty <div>. Give it the headline, a description and a walkable
  //     list of the most recent roles.
  const recent = jobs.slice(0, 200);
  writePage(template, {
    path: '/',
    title: 'International Student Job Board | Australian Startup Jobs',
    description:
      'Curated startup and scaleup jobs in Australia for international students and graduates, with migration pathways and visa info!',
    body: [
      '<main>',
      '<h1>Jobs at Australian startups, mapped with migration pathways and visa requirements!</h1>',
      `<p>${esc(
        'Curated startup and scaleup roles across Australia for international students ' +
          'and graduates. Every listing shows the visa pathways, ANZSCO occupation and ' +
          'skills assessment that apply, and whether the employer sponsors visas.'
      )}</p>`,
      nav,
      `<h2>Latest roles${jobs.length > recent.length ? ` (${recent.length} of ${jobs.length.toLocaleString('en-AU')})` : ''}</h2>`,
      '<ul>',
      ...recent.map(jobLink),
      '</ul>',
      '</main>',
    ].join(''),
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
