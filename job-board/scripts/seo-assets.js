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
// 4. recent-jobs.csv - the newest three days of roles, which the app shows while
//    the full board downloads (see scripts/recent-window.js). The same roles are
//    listed in the landing page's HTML for a crawler that never runs the app.
//
// Safe to run again over the same folder: it starts each time from the app shell
// with the previous run's body and structured data stripped back out.
//
// Roles older than the board's listing window are left out: a sitemap is a
// claim that a URL is worth indexing, and those have already stopped showing.

const fs = require('fs');
const path = require('path');
const {
  landingPages,
  pathFor: landingPathFor,
  splitLocation,
  splitLevels,
  LEVEL_ORDER,
  typeLabel,
  STATE_ABBREVIATIONS,
} = require('./landing-pages');
const { contentPath, DATA_FILES } = require('./data-files');
const { recentWindow, RECENT_DAYS } = require('./recent-window');

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
  // Every replacement is a function, never a string. A replacement string is read for `$1`, `$&`
  // and the like, and a role's description says "Pay around A$104k": the `$1` in it was replaced
  // with the text the pattern had just captured, splicing a fragment of the page's own <meta>
  // into the description of every role paid over A$100k.
  const attr = (pattern, value) => (text) => text.replace(pattern, (_, open, close) => `${open}${esc(value)}${close}`);
  const head = [
    (text) => text.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(title)}</title>`),
    attr(/(<meta name="description" content=")[^"]*(")/, description),
    attr(/(<link rel="canonical" href=")[^"]*(")/, url),
    attr(/(<meta property="og:title" content=")[^"]*(")/, title),
    attr(/(<meta property="og:description" content=")[^"]*(")/, description),
    attr(/(<meta property="og:url" content=")[^"]*(")/, url),
  ].reduce((text, apply) => apply(text), template);

  // A replacement that went wrong shows up as a second copy of the tag it was meant to fill in.
  // Fail the build rather than publish a page with its own <meta> inside its description.
  if ((head.match(/<meta name="description"/g) || []).length !== 1) {
    throw new Error(`seo-assets: the description on ${urlPath} was written into the page wrongly`);
  }

  const withSchema = schema
    ? head.replace(
        '</head>',
        // The id is the one src/seo.ts's applySchema looks for. Without it the app,
        // once mounted, adds a second JobPosting block beside this one instead of
        // replacing it - and two blocks for one role can disagree.
        () => `<script type="application/ld+json" id="page-schema">${JSON.stringify(schema)}</script></head>`
      )
    : head;

  // .preboot is styled inline in the template's <head> - see public/index.html -
  // so this reads as a lightweight version of the page rather than raw HTML for
  // the moment before React mounts and replaces it.
  const html = body
    ? withSchema.replace(
        '<div id="root"></div>',
        () => `<div id="root"><div class="preboot">${body}</div></div>`
      )
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

/** "Melbourne" + "Victoria" -> "Melbourne, Victoria"; no city, no place. */
function placeKey(city, state) {
  const name = String(city || '').trim();
  if (!name) return '';
  const region = String(state || '').trim();
  return region ? `${name}, ${region}` : name;
}

/** The middle of a pay range, else the estimate, else 0. */
function midpoint(min, max, estimate) {
  const [lo, hi] = [min, max].map((n) => (Number.isFinite(n) && n > 0 ? n : 0));
  if (lo && hi) return Math.round((lo + hi) / 2);
  if (lo || hi) return lo || hi;
  return Number.isFinite(estimate) && estimate > 0 ? Math.round(estimate) : 0;
}

/** The numeric id in a LinkedIn job URL, or 0. LinkedIn allocates them roughly in time order. */
function linkedinId(url) {
  const match = url.match(/linkedin\.com\/jobs\/view\/(?:[a-z0-9-]*-)?(\d{6,})/i);
  return match ? Number(match[1]) : 0;
}

function readJobs() {
  const file = DATA_FILES.find((f) => f.url === '/jobs.csv');
  const source = contentPath(file.name);
  if (!fs.existsSync(source)) return { headerLine: '', jobs: [] };

  const lines = fs.readFileSync(source, 'utf8').split(/\r?\n/).filter(Boolean);
  const header = splitCsvLine(lines[0]).map((c) => c.trim());
  const at = (cells, name) => cells[header.indexOf(name)] || '';

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - MONTHS_LISTED);
  const oldest = cutoff.toISOString().slice(0, 10);

  const jobs = lines
    .slice(1)
    .map((line) => ({ line, cells: splitCsvLine(line) }))
    .map(({ line, cells }) => {
      const advertPosted = at(cells, 'Advert posted').trim();
      const datePosted = at(cells, 'Date posted').trim();
      return {
        // The row exactly as it sits in the file, so the pre-loaded snapshot is a
        // slice of the real CSV and the app reads it with the same parser.
        line,
        id: at(cells, 'Job ID').trim(),
        title: at(cells, 'Job title').trim(),
        company: at(cells, 'Company name').trim(),
        tagline: at(cells, 'Tagline').trim(),
        type: at(cells, 'Job type').trim(),
        occupation: at(cells, 'ANZSCO occupation').trim(),
        city: at(cells, 'Job city').trim(),
        // The role's own city and state, worked out by the pipeline from where the advert
        // says it is. The row's `State` column is the employer's, which is why it isn't
        // used: beside a role's city it printed "Melbourne, New South Wales".
        locationCity: at(cells, 'Job location city').trim(),
        locationState: at(cells, 'Job location state').trim(),
        location: placeKey(at(cells, 'Job location city'), at(cells, 'Job location state')),
        country: at(cells, 'Job country').trim(),
        posted: advertPosted || datePosted,
        employmentType: at(cells, 'Employment type').trim(),
        level: at(cells, 'Job level').trim(),
        levels: splitLevels(at(cells, 'Job level')),
        arrangement: at(cells, 'Work arrangement').trim(),
        education: at(cells, 'Education level').trim(),
        salaryMinAud: Math.round(Number(at(cells, 'Base salary min AUD'))) || 0,
        salaryMaxAud: Math.round(Number(at(cells, 'Base salary max AUD'))) || 0,
        // One figure for the role, for summarising a page of them: the middle of its range,
        // or the company's estimate when there is no range.
        salaryMid: midpoint(
          Number(at(cells, 'Base salary min AUD')),
          Number(at(cells, 'Base salary max AUD')),
          Number(at(cells, 'Company salary estimate AUD'))
        ),
        salary: moneyAud(
          at(cells, 'Base salary min AUD'),
          at(cells, 'Base salary max AUD'),
          at(cells, 'Company salary estimate AUD')
        ),
        url: at(cells, 'Job URL').trim(),
        sponsor: /^true$/i.test(at(cells, 'Accredited sponsor').trim()),
        hiresStudents: /^true$/i.test(at(cells, 'Hires international students').trim()),
      };
    })
    .filter((job) => job.id && job.title && (!job.posted || job.posted >= oldest))
    // Newest first, and within a day the way the app orders it (linkedinId in src/jobs.ts):
    // hundreds of roles share Dealroom's batch date, so without the tiebreak the list a
    // crawler reads and the one a visitor sees would put different roles on top.
    .sort(
      (a, b) =>
        (b.posted || '').localeCompare(a.posted || '') ||
        linkedinId(b.url) - linkedinId(a.url) ||
        b.id.localeCompare(a.id)
    );

  return { headerLine: lines[0], jobs };
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
    .replace(/(<div id="root">)[\s\S]*?(<\/div>\s*<\/body>)/, '$1$2')
    // The structured data a previous run put in the head, for the same reason: this file is
    // rewritten with the landing page's own block, and every page is stamped from it, so a
    // second run over the same folder (the README's "refresh just the data" step) would stack
    // a second block on the first.
    .replace(/<script type="application\/ld\+json" id="page-schema">[\s\S]*?<\/script>/g, '');
  fs.writeFileSync(path.join(outDir, '404.html'), template);

  // 2. The sitemap. Pages first, then roles; the board changes daily and a
  //    role only when it is re-listed, which is what changefreq says here.
  const { headerLine, jobs } = readJobs();
  const today = new Date().toISOString().slice(0, 10);
  // The views with enough roles to be a page of their own - see scripts/landing-pages.js.
  const landing = landingPages(jobs);
  const landingByPath = new Map(landing.map((page) => [page.path, page]));
  const urls = [
    { loc: '/', priority: '1.0', changefreq: 'daily' },
    { loc: '/companies', priority: '0.8', changefreq: 'weekly' },
    { loc: '/about', priority: '0.5', changefreq: 'monthly' },
    { loc: '/post', priority: '0.5', changefreq: 'monthly' },
    // Between the pages and the roles: the views people search for, refreshed with the board.
    ...landing.map((page) => ({ loc: page.path, priority: '0.8', changefreq: 'daily' })),
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

  /** A link to a landing page, or nothing when that view has too few roles to be one. */
  const landingLink = (view, text) => {
    const target = landingPathFor(view);
    const page = target && landingByPath.get(target);
    return page ? `<a href="${esc(page.path)}">${esc(text || page.heading)}</a>` : '';
  };

  const pageList = (pages, limit) =>
    pages.length
      ? '<ul>' +
        pages
          .slice(0, limit)
          .map(
            (page) =>
              `<li><a href="${esc(page.path)}">${esc(page.heading)}</a> ` +
              `(${page.stats.count.toLocaleString('en-AU')} roles)</li>`
          )
          .join('') +
        '</ul>'
      : '';

  const cityPages = landing.filter(
    (page) => page.location && !page.type && !page.sponsor && !page.level
  );
  const typePages = landing.filter((page) => page.type && !page.location && !page.sponsor);
  const levelPages = landing.filter((page) => page.level && !page.location);
  const sponsorPages = landing.filter((page) => page.sponsor && !(page.location && page.type));

  /** Every way into the board a person might search for, as links a crawler can follow. */
  const browse = () =>
    [
      cityPages.length
        ? `<section aria-labelledby="browse-cities"><h2 id="browse-cities">Jobs by city</h2>${pageList(cityPages, 12)}</section>`
        : '',
      typePages.length
        ? `<section aria-labelledby="browse-types"><h2 id="browse-types">Jobs by kind of work</h2>${pageList(typePages, 12)}</section>`
        : '',
      levelPages.length
        ? `<section aria-labelledby="browse-levels"><h2 id="browse-levels">Jobs by level</h2>${pageList(levelPages, 12)}</section>`
        : '',
      sponsorPages.length
        ? `<section aria-labelledby="browse-sponsors"><h2 id="browse-sponsors">Visa sponsorship</h2>${pageList(sponsorPages, 12)}</section>`
        : '',
    ].join('');

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
      ['Location', [job.city, job.country].filter(Boolean).join(', ')],
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
            ...(job.city || job.locationCity
              ? { addressLocality: job.city || job.locationCity }
              : {}),
            // The state of the place the advert names, not the employer's - the row's own
            // `State` was wrong for 15% of roles, which is why this was left out until the
            // pipeline could place the role itself. Absent when it couldn't (a name that is
            // in several states): a wrong value in structured data is worse than a missing one.
            ...(job.locationState
              ? { addressRegion: STATE_ABBREVIATIONS[job.locationState] || job.locationState }
              : {}),
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
        (() => {
          // The views this role belongs to, when they are pages: how a crawler gets from one
          // role to the rest of its city, its kind of work and the sponsors.
          const views = [
            landingLink({ location: job.location, type: job.type }),
            landingLink({ location: job.location }),
            landingLink({ type: job.type }),
            ...job.levels.map((level) => landingLink({ level })),
            job.sponsor ? landingLink({ sponsor: true }) : '',
          ].filter(Boolean);
          return views.length
            ? `<p class="pj-lede">More like this: ${views.join(' · ')}</p>`
            : '';
        })(),
        '<section aria-label="More roles"><h2>More roles at Australian startups</h2><ul>',
        ...related.map(jobLink),
        '</ul></section>',
        nav,
      ].join(''),
    });
  });

  // 2b. The landing page itself - the most linked page on the site and, until
  //     it was given a body, an empty <div>. It leads with the newest three days
  //     of roles, in full: title, employer, place, pay, when, and whether the
  //     employer sponsors. The same rows are written to recent-jobs.csv, which the
  //     app reads first so a visitor sees them without waiting for the whole board.
  const recentDays = recentWindow(jobs, today);
  const shortDate = (iso) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
  // "Posted in the last 3 days" is only true while the data is fresh. When a
  // refresh is overdue the window still holds the newest three days there are,
  // so it says which days instead of claiming they are recent.
  // The window is the three days ending on the newest posting, so it is "the last 3 days"
  // only while that posting is from today or yesterday.
  const fresh = recentDays.to && daysBetween(recentDays.to, today) <= 1;
  const recentHeading = fresh
    ? `Posted in the last ${RECENT_DAYS} days`
    : 'Latest roles';
  // "15-17 Sept 2026" when it sits in one month, both dates in full when it doesn't.
  const recentRange =
    recentDays.from === recentDays.to
      ? shortDate(recentDays.to)
      : recentDays.from.slice(0, 7) === recentDays.to.slice(0, 7)
        ? `${Number(recentDays.from.slice(8))}\u2013${shortDate(recentDays.to)}`
        : `${shortDate(recentDays.from)} \u2013 ${shortDate(recentDays.to)}`;

  /** One of the newest roles, as a card. Mirrors .job-card so the swap to the app is quiet. */
  const recentCard = (job) => {
    const meta = [job.city, job.type, job.employmentType, job.salary]
      .filter((v, i, all) => v && all.indexOf(v) === i)
      .join(' · ');
    const flags = [
      job.sponsor ? 'Accredited sponsor' : '',
      job.hiresStudents ? 'Hires international students and graduates' : '',
    ].filter(Boolean);
    return (
      '<li class="pj">' +
      `<a class="pj-title" href="/jobs/${esc(job.id)}">${esc(job.title)}</a>` +
      `<span class="pj-company">${esc(job.company)}</span>` +
      (meta ? `<span class="pj-meta">${esc(meta)}</span>` : '') +
      `<time class="pj-posted" datetime="${esc(job.posted)}">Posted ${esc(shortDate(job.posted))}</time>` +
      (flags.length
        ? `<span class="pj-flags">${flags.map((f) => `<span class="pj-flag">${esc(f)}</span>`).join('')}</span>`
        : '') +
      '</li>'
    );
  };

  const inWindow = new Set(recentDays.jobs.map((job) => job.id));
  const earlier = jobs.filter((job) => !inWindow.has(job.id)).slice(0, 100);

  if (headerLine && recentDays.jobs.length) {
    fs.writeFileSync(
      path.join(outDir, 'recent-jobs.csv'),
      [headerLine, ...recentDays.jobs.map((job) => job.line), ''].join('\n')
    );
  }

  writePage(template, {
    path: '/',
    title: 'International Student Job Board | Australian Startup Jobs',
    description:
      'Curated startup and scaleup jobs in Australia for international students and graduates, with migration pathways and visa info!',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE,
      url: `${siteUrl}/`,
      description:
        'Curated startup and scaleup jobs across Australia for international students ' +
        'and recent graduates, mapped with the migration pathways and visa requirements.',
    },
    body: [
      '<main>',
      '<h1>Jobs at Australian startups, mapped with migration pathways and visa requirements!</h1>',
      `<p>${esc(
        'Curated startup and scaleup roles across Australia for international students ' +
          'and graduates. Every listing shows the visa pathways, ANZSCO occupation and ' +
          'skills assessment that apply, and whether the employer sponsors visas.'
      )}</p>`,
      nav,
      recentDays.jobs.length
        ? [
            '<section aria-labelledby="new-roles">',
            `<h2 id="new-roles">${esc(recentHeading)}</h2>`,
            `<p class="pj-lede">${esc(
              `${recentDays.jobs.length.toLocaleString('en-AU')} ${
                recentDays.jobs.length === 1 ? 'role' : 'roles'
              } posted ${recentRange}.`
            )}</p>`,
            '<ul class="pj-list">',
            ...recentDays.jobs.map(recentCard),
            '</ul>',
            '</section>',
          ].join('')
        : '',
      earlier.length
        ? [
            '<section aria-labelledby="earlier-roles">',
            `<h2 id="earlier-roles">Earlier roles (${earlier.length} of ${(
              jobs.length - recentDays.jobs.length
            ).toLocaleString('en-AU')})</h2>`,
            '<ul>',
            ...earlier.map(jobLink),
            '</ul>',
            '</section>',
          ].join('')
        : '',
      browse(),
      '</main>',
    ].join(''),
  });

  // 2c. The landing pages: the board with a view switched on, written out in full. Each
  //     leads with what is true of that view - how many roles, how many employers, how many
  //     sponsor, what they pay - and the newest of its roles, then links onward: to the same
  //     kind of work in other cities, the same city in other kinds of work, and the sponsors.
  const LISTED = 30;
  landing.forEach((page) => {
    const parent = page.level && page.location
      ? { level: page.level }
      : page.location && (page.type || page.sponsor)
      ? { location: page.location }
      : page.sponsor && page.type
        ? { sponsor: true }
        : null;
    const parentPage = parent && landingByPath.get(landingPathFor(parent));

    // Where to go from here, by what kind of page this is: the neighbours a person searching
    // for this would also want, and always a way up to the wider view.
    const others = (test) => landing.filter((other) => other !== page && test(other));
    const plain = (other) => !other.sponsor && !other.level;
    const levelsHere = page.location
      ? others((o) => o.level && o.location === page.location)
      : [];
    const sections = (
      page.level
        ? page.location
          ? [
              [`${typeLabel(page.level)} jobs in other cities`, others((o) => o.level === page.level && o.location)],
              [`Other levels in ${splitLocation(page.location).city}`, others((o) => o.level && o.location === page.location)],
            ]
          : [
              [`${typeLabel(page.level)} jobs by city`, others((o) => o.level === page.level && o.location)],
              ['Other levels', others((o) => o.level && !o.location)],
            ]
        : page.sponsor
        ? [
            [
              page.location && !page.type ? 'Visa sponsorship in other cities' : 'Visa sponsorship by city',
              others((o) => o.sponsor && o.location && !o.type),
            ],
            [
              page.type ? 'Visa sponsorship in other kinds of work' : 'Visa sponsorship by kind of work',
              others((o) => o.sponsor && o.type && !o.location),
            ],
          ]
        : page.location && page.type
          ? [
              [`${typeLabel(page.type)} jobs in other cities`, others((o) => plain(o) && o.type === page.type && o.location)],
              [`Other kinds of work in ${splitLocation(page.location).city}`, others((o) => plain(o) && o.location === page.location && o.type)],
            ]
          : page.location
            ? [
                [`${splitLocation(page.location).city} by kind of work`, others((o) => plain(o) && o.location === page.location && o.type)],
                ['Other cities', others((o) => plain(o) && o.location && !o.type && !o.level)],
                ...(levelsHere.length ? [[`${splitLocation(page.location).city} by level`, levelsHere]] : []),
              ]
            : [
                [`${typeLabel(page.type)} jobs by city`, others((o) => plain(o) && o.type === page.type && o.location)],
                ['Other kinds of work', others((o) => plain(o) && o.type && !o.location)],
              ]
    ).filter(([, pages]) => pages.length);

    // The same view with sponsorship switched on - or, from a sponsorship page, off. A level
    // has no sponsor version.
    const sponsorSwitch = page.level
      ? ''
      : page.sponsor
      ? landingLink(
          { ...(page.location ? { location: page.location } : {}), ...(page.type ? { type: page.type } : {}) },
          'See all roles, not only sponsors'
        )
      : landingLink(
          { ...(page.location ? { location: page.location } : {}), ...(page.type ? { type: page.type } : {}), sponsor: true },
          'Only employers that sponsor visas'
        );

    const related = [
      ...sections.map(([heading, pages]) => `<h2>${esc(heading)}</h2>${pageList(pages, 12)}`),
      sponsorSwitch ? `<p>${sponsorSwitch}</p>` : '',
    ].join('');

    const url = siteUrl + page.path;
    const crumbs = [
      { name: 'Home', url: `${siteUrl}/` },
      ...(parentPage ? [{ name: parentPage.heading, url: siteUrl + parentPage.path }] : []),
      { name: page.heading, url },
    ];
    const listed = page.jobs.slice(0, LISTED);

    writePage(template, {
      path: page.path,
      title: `${page.heading} | ${SITE}`,
      description: page.lead,
      schema: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'CollectionPage',
            name: page.heading,
            description: page.lead,
            url,
            isPartOf: { '@type': 'WebSite', name: SITE, url: `${siteUrl}/` },
            mainEntity: {
              '@type': 'ItemList',
              numberOfItems: page.stats.count,
              itemListElement: listed.map((job, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                url: `${siteUrl}/jobs/${job.id}`,
                name: job.title,
              })),
            },
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: crumbs.map((crumb, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: crumb.name,
              item: crumb.url,
            })),
          },
        ],
      },
      body: [
        '<main>',
        `<nav aria-label="Breadcrumb"><a href="/">All roles</a>${
          parentPage ? ` \u203a <a href="${esc(parentPage.path)}">${esc(parentPage.heading)}</a>` : ''
        }</nav>`,
        `<h1>${esc(page.heading)}</h1>`,
        `<p>${esc(page.lead)}</p>`,
        '<section aria-labelledby="landing-roles">',
        `<h2 id="landing-roles">${
          page.stats.count > LISTED ? `The newest ${LISTED} roles` : 'Roles'
        }</h2>`,
        page.stats.count > LISTED
          ? `<p class="pj-lede">${esc(
              `${page.stats.count.toLocaleString('en-AU')} in all. The board filters the rest by ` +
                'pay, level, work arrangement, sponsor and more.'
            )}</p>`
          : '',
        '<ul class="pj-list">',
        ...listed.map(recentCard),
        '</ul>',
        '</section>',
        related,
        nav,
        '</main>',
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
    `seo-assets: ${urls.length} pages written (${jobs.length} roles, ${landing.length} landing pages), plus 404.html, ` +
      `robots.txt and sitemap.xml -> ${target}\n` +
      `seo-assets: ${recentDays.jobs.length} roles pre-loaded` +
      (recentDays.from ? ` (${recentDays.from} to ${recentDays.to})` : '')
  );
}

main();
