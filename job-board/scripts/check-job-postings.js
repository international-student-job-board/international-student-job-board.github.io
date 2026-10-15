// Checks a built site's job postings against Google's job posting guide, before Google does:
// https://developers.google.com/search/docs/appearance/structured-data/job-posting
//
//   node scripts/check-job-postings.js <build dir>      (npm run check:jobs checks ../docs)
//
// Every role page must carry one JobPosting with the required properties, in the forms the guide
// asks for; no page that lists roles may carry one at all; and every role in the sitemap must have
// its page. Problems are listed and the exit code is 1, so it can gate a deploy. The Rich Results
// Test (https://search.google.com/test/rich-results) is still worth running on a few live pages -
// this checks what the guide states, not everything Google might.

const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
if (!dir || !fs.existsSync(dir)) {
  console.error('check-job-postings: give the built site directory, e.g. `build` or `../docs`');
  process.exit(2);
}

const EMPLOYMENT_TYPES = new Set([
  'FULL_TIME',
  'PART_TIME',
  'CONTRACTOR',
  'TEMPORARY',
  'INTERN',
  'VOLUNTEER',
  'PER_DIEM',
  'OTHER',
]);
const UNIT_TEXT = new Set(['HOUR', 'DAY', 'WEEK', 'MONTH', 'YEAR']);
const CREDENTIALS = new Set([
  'high school',
  'associate degree',
  'bachelor degree',
  'professional certificate',
  'postgraduate degree',
]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/;
const today = new Date().toISOString().slice(0, 10);

/** Every structured-data block on a page, parsed. */
function blocks(html) {
  return Array.from(
    html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g),
    (m) => JSON.parse(m[1])
  );
}

/** Whether a block, or anything nested in it, is a JobPosting. */
const hasJobPosting = (value) =>
  Boolean(value) &&
  typeof value === 'object' &&
  (value['@type'] === 'JobPosting' || Object.values(value).some(hasJobPosting));

function checkPosting(p, canonical) {
  const problems = [];
  const need = (ok, message) => ok || problems.push(message);

  // Required.
  need(typeof p.title === 'string' && p.title.trim().length >= 3, 'title is missing');
  need(!/[$!*]/.test(p.title || ''), `title has a salary or special characters: "${p.title}"`);
  const letters = (p.title || '').replace(/[^a-z]/gi, '');
  const long = (p.title || '').split(/\s+/).filter((w) => w.replace(/[^a-z]/gi, '').length > 3);
  need(!(letters && letters === letters.toUpperCase() && long.length >= 2), `title is all capitals: "${p.title}"`);
  need(typeof p.description === 'string' && /<p>/.test(p.description), 'description is not HTML with paragraphs');
  need(p.description !== p.title, 'description is only the title');
  need(ISO_DATE.test(p.datePosted || ''), 'datePosted is missing or not ISO 8601');
  need(!p.datePosted || p.datePosted.slice(0, 10) <= today, `datePosted is in the future: ${p.datePosted}`);
  need(p.hiringOrganization && p.hiringOrganization.name, 'hiringOrganization has no name');
  need(
    p.jobLocation && p.jobLocation.address && p.jobLocation.address.addressCountry,
    'jobLocation has no addressCountry'
  );

  // Recommended - wrong is worse than missing, so each is checked when present.
  if (p.validThrough) {
    need(ISO_DATE.test(p.validThrough), 'validThrough is not ISO 8601');
    // A past validThrough is one of Google's three ways of retiring a role, so it is counted, not
    // failed: it means the build is older than the role, and the next one drops the page.
    if (p.validThrough.slice(0, 10) < today) expired += 1;
  }
  if (p.employmentType) {
    const types = [].concat(p.employmentType);
    need(types.every((t) => EMPLOYMENT_TYPES.has(t)), `employmentType "${types}" is not a Google value`);
  }
  if (p.jobLocationType) {
    need(p.jobLocationType === 'TELECOMMUTE', `jobLocationType "${p.jobLocationType}" is not TELECOMMUTE`);
    need(p.applicantLocationRequirements, 'a remote role has no applicantLocationRequirements');
    need(/100% remote/i.test(p.description || ''), 'a remote role\'s description does not say it is 100% remote');
  }
  if (p.baseSalary) {
    const v = p.baseSalary.value || {};
    need(/^[A-Z]{3}$/.test(p.baseSalary.currency || ''), 'baseSalary has no ISO 4217 currency');
    need(UNIT_TEXT.has(v.unitText), `baseSalary unitText "${v.unitText}" is not a Google value`);
    need(
      [v.value, v.minValue, v.maxValue].some((n) => typeof n === 'number' && n > 0),
      'baseSalary has no figure'
    );
    need(!(v.minValue > v.maxValue), 'baseSalary minValue is above maxValue');
  }
  if (p.educationRequirements) {
    need(
      CREDENTIALS.has(p.educationRequirements.credentialCategory),
      `credentialCategory "${p.educationRequirements.credentialCategory}" is not a Google value`
    );
  }
  need(p.url === canonical, `url ${p.url} is not the page's canonical ${canonical}`);
  return problems;
}

const pages = [];
(function walk(at) {
  for (const entry of fs.readdirSync(at, { withFileTypes: true })) {
    const full = path.join(at, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name === 'index.html') pages.push(full);
  }
})(dir);

const problems = [];
let roles = 0;
let withSalary = 0;
let remote = 0;
let expired = 0;
for (const file of pages) {
  const rel = `/${path.relative(dir, path.dirname(file)).split(path.sep).join('/')}`.replace(/\/$/, '') || '/';
  const html = fs.readFileSync(file, 'utf8');
  const found = blocks(html);
  const canonical = (html.match(/<link rel="canonical" href="([^"]*)"/) || [])[1];
  const isRole = /^\/jobs\/[^/]+$/.test(rel);

  if (!isRole) {
    // "Don't add structured data to pages intended to present a list of jobs."
    if (found.some(hasJobPosting)) problems.push(`${rel}: a page that is not a single role carries a JobPosting`);
    continue;
  }
  roles += 1;
  const postings = found.filter((b) => b['@type'] === 'JobPosting');
  if (postings.length !== 1) {
    problems.push(`${rel}: ${postings.length} JobPosting blocks, not one`);
    continue;
  }
  if (postings[0].baseSalary) withSalary += 1;
  if (postings[0].jobLocationType) remote += 1;
  for (const problem of checkPosting(postings[0], canonical)) problems.push(`${rel}: ${problem}`);
}

// Every role the sitemap offers has its page.
const sitemap = fs.existsSync(path.join(dir, 'sitemap.xml'))
  ? fs.readFileSync(path.join(dir, 'sitemap.xml'), 'utf8')
  : '';
for (const [, loc] of sitemap.matchAll(/<loc>[^<]*?(\/jobs\/[^<]+?)\/?<\/loc>/g)) {
  if (!fs.existsSync(path.join(dir, loc, 'index.html'))) problems.push(`sitemap lists ${loc}, which has no page`);
}

console.log(
  `check-job-postings: ${roles} role pages (${withSalary} with a stated salary, ${remote} fully remote), ` +
    `${pages.length - roles} other pages` +
    (expired ? `; ${expired} have expired (Google drops them - the next build removes their pages)` : '')
);
if (problems.length) {
  console.log(`${problems.length} problem(s):`);
  problems.slice(0, 50).forEach((p) => console.log(`  ${p}`));
  if (problems.length > 50) console.log(`  ... and ${problems.length - 50} more`);
  process.exit(1);
}
console.log('every job posting follows the guide');
