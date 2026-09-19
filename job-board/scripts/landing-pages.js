'use strict';

// The landing pages: one address for each view a person searches for - the jobs in a city, a
// kind of job, the roles at employers that sponsor visas, and the combinations of those.
//
// A landing page is the board with those filters switched on, no more. Its address is the
// filters written as a path, so the app reads it back into the same filters (src/landing.ts) and
// a person who picks the same filters by hand ends up on the same address. This file is where the
// set of them, and what each says, is decided; seo-assets.js turns them into files, and
// src/landing.test.ts holds src/landing.ts to the same slugs and headings.
//
//   /jobs-in/melbourne                       city
//   /roles/backend-development               kind of job
//   /jobs-in/sydney/marketing-and-communication
//   /visa-sponsorship                        employers on the Home Affairs sponsor register
//   /visa-sponsorship/in/perth
//   /visa-sponsorship/roles/sales
//   /levels/graduate                         job level (Graduate, Junior, Senior...)
//   /levels/graduate/in/sydney
//
// A view only gets a page once it has MIN_ROLES roles: a page with three roles on it is thin
// content, and a search for it is better answered by the board.

const MIN_ROLES = 10;

/** The kind of job Dealroom files a role under when it can't say. A page for it would be a page
 * about nothing, so it is never one. */
const NO_CATEGORY = 'Other';

const STATE_ABBREVIATIONS = {
  'New South Wales': 'NSW',
  Victoria: 'VIC',
  Queensland: 'QLD',
  'South Australia': 'SA',
  'Western Australia': 'WA',
  Tasmania: 'TAS',
  'Northern Territory': 'NT',
  'Australian Capital Territory': 'ACT',
};

/** "Marketing & Communication" -> "marketing-and-communication". */
const slugify = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** "Melbourne, Victoria" -> { city: 'Melbourne', state: 'Victoria' }. */
function splitLocation(location) {
  const at = location.lastIndexOf(', ');
  return at === -1
    ? { city: location, state: '' }
    : { city: location.slice(0, at), state: location.slice(at + 2) };
}

const citySlug = (location) => slugify(splitLocation(location).city);

/** "Melbourne, Victoria" -> "Melbourne, VIC": how a place reads in a heading. */
function locationLabel(location) {
  const { city, state } = splitLocation(location);
  return state ? `${city}, ${STATE_ABBREVIATIONS[state] || state}` : city;
}

/** A job type as the board writes it: each word capitalised unless it already carries a capital. */
const typeLabel = (type) =>
  String(type || '')
    .trim()
    .split(/\s+/)
    .map((word) => (/[A-Z]/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');

/** Seniority, lowest first - the order the levels are listed in. */
const LEVEL_ORDER = ['Internship', 'Graduate', 'Junior', 'Mid', 'Senior', 'Lead', 'Director', 'Executive'];

/** "Mid;Senior" -> ['Mid', 'Senior']: a role can sit at more than one level. */
const splitLevels = (value) =>
  String(value || '')
    .split(/[;|]/)
    .map((v) => v.trim())
    .filter(Boolean);

/** The path a set of filters is written as, or null when they aren't one of the landing views. */
function pathFor({ location, type, sponsor, level }) {
  const city = location ? citySlug(location) : '';
  const kind = type ? slugify(type) : '';
  if (level) {
    // A level is its own axis: alone, or in a city - not also a kind of work or sponsors.
    if (kind || sponsor) return null;
    return city ? `/levels/${slugify(level)}/in/${city}` : `/levels/${slugify(level)}`;
  }
  if (sponsor) {
    if (city && kind) return null; // three filters at once is a search, not a page
    if (city) return `/visa-sponsorship/in/${city}`;
    if (kind) return `/visa-sponsorship/roles/${kind}`;
    return '/visa-sponsorship';
  }
  if (city && kind) return `/jobs-in/${city}/${kind}`;
  if (city) return `/jobs-in/${city}`;
  if (kind) return `/roles/${kind}`;
  return null;
}

/** What a view is called. */
function headingFor({ location, type, sponsor, level }) {
  const city = location ? splitLocation(location).city : '';
  const kind = type ? typeLabel(type) : level ? typeLabel(level) : '';
  if (sponsor) {
    if (city) return `Visa sponsorship jobs in ${city}`;
    if (kind) return `${kind} jobs with visa sponsorship`;
    return 'Startup jobs with visa sponsorship in Australia';
  }
  if (city && kind) return `${kind} jobs in ${city}`;
  if (city) return `Startup jobs in ${city}`;
  return `${kind} jobs at Australian startups`;
}

/** The value at a fraction of the way through the sorted list. */
function percentile(sorted, fraction) {
  if (!sorted.length) return 0;
  const at = (sorted.length - 1) * fraction;
  const low = Math.floor(at);
  const high = Math.ceil(at);
  return sorted[low] + (sorted[high] - sorted[low]) * (at - low);
}

const kAud = (value) => `A$${Math.round(value / 1000)}k`;

/** What the roles in a view amount to: how many, at how many employers, how many of them sponsor,
 * and what the ones that say pay. */
function statsFor(jobs) {
  const pay = jobs
    .map((job) => job.salaryMid)
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  const sponsored = jobs.filter((job) => job.sponsor).length;
  return {
    count: jobs.length,
    employers: new Set(jobs.map((job) => job.company)).size,
    sponsored,
    sponsorPercent: jobs.length ? Math.round((100 * sponsored) / jobs.length) : 0,
    payCount: pay.length,
    payLow: percentile(pay, 0.25),
    payMedian: percentile(pay, 0.5),
    payHigh: percentile(pay, 0.75),
  };
}

/** Enough roles with pay to say something about it without it being one employer's figure. */
const MIN_PAID = 5;

/** The sentence under the heading - and the page's description. Real numbers for this view only. */
function leadFor(view, stats) {
  const { location, type, sponsor, level } = view;
  const scope = [
    type || level ? `${typeLabel(type || level)} ` : '',
    'roles',
    location ? ` in ${locationLabel(location)}` : ' across Australia',
    sponsor ? ' at accredited visa sponsors' : '',
  ].join('');
  const opening =
    `${stats.count.toLocaleString('en-AU')} open ${scope}, ` +
    `at ${stats.employers.toLocaleString('en-AU')} ` +
    `${stats.employers === 1 ? 'startup or scaleup' : 'startups and scaleups'}.`;
  const sponsors = sponsor
    ? ''
    : stats.sponsored
      ? ` ${stats.sponsorPercent}% are at employers on the Home Affairs accredited sponsor register.`
      : '';
  const pay =
    stats.payCount >= MIN_PAID
      ? ` Pay typically runs ${kAud(stats.payLow)}–${kAud(stats.payHigh)} ` +
        `(median ${kAud(stats.payMedian)}) across the ${stats.payCount} roles that state or estimate it.`
      : '';
  return `${opening}${sponsors}${pay}`;
}

/** Every landing page the roles support, each with the roles that belong on it, biggest first. */
function landingPages(jobs) {
  const group = (pick) => {
    const groups = new Map();
    for (const job of jobs) {
      const key = pick(job);
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(job);
    }
    return groups;
  };

  const eligible = (map) =>
    new Map([...map].filter(([, list]) => list.length >= MIN_ROLES).sort((a, b) => b[1].length - a[1].length));

  const cities = eligible(group((job) => job.location));
  const types = eligible(group((job) => (job.type === NO_CATEGORY ? '' : job.type)));
  // A role at two levels is on both pages, as the Job level filter has it.
  const levelGroups = new Map();
  for (const job of jobs) {
    for (const level of job.levels || []) {
      if (!levelGroups.has(level)) levelGroups.set(level, []);
      levelGroups.get(level).push(job);
    }
  }
  const levels = new Map(
    [...eligible(levelGroups)].sort((a, b) => LEVEL_ORDER.indexOf(a[0]) - LEVEL_ORDER.indexOf(b[0]))
  );

  // Two places with one name would share an address. Keep the one with more roles.
  const taken = new Set();
  for (const location of [...cities.keys()]) {
    const slug = citySlug(location);
    if (taken.has(slug)) cities.delete(location);
    else taken.add(slug);
  }

  const pages = [];
  const add = (view, list) => {
    if (list.length < MIN_ROLES) return;
    const path = pathFor(view);
    const heading = headingFor(view);
    pages.push({ ...view, path, heading, jobs: list, stats: statsFor(list), lead: leadFor(view, statsFor(list)) });
  };

  for (const [location, list] of cities) add({ location }, list);
  for (const [type, list] of types) add({ type }, list);
  for (const [location, inCity] of cities) {
    for (const [type] of types) add({ location, type }, inCity.filter((job) => job.type === type));
  }

  for (const [level, list] of levels) {
    add({ level }, list);
    for (const [location, inCity] of cities) {
      add({ level, location }, inCity.filter((job) => list.includes(job)));
    }
  }

  const sponsors = jobs.filter((job) => job.sponsor);
  add({ sponsor: true }, sponsors);
  for (const [location] of cities) add({ location, sponsor: true }, sponsors.filter((job) => job.location === location));
  for (const [type] of types) add({ type, sponsor: true }, sponsors.filter((job) => job.type === type));

  return pages;
}

module.exports = {
  MIN_ROLES,
  NO_CATEGORY,
  STATE_ABBREVIATIONS,
  slugify,
  splitLocation,
  citySlug,
  locationLabel,
  typeLabel,
  splitLevels,
  LEVEL_ORDER,
  pathFor,
  headingFor,
  leadFor,
  statsFor,
  landingPages,
};
