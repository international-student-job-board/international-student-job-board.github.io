// The landing pages, from the app's side: an address such as /jobs-in/melbourne is the board with
// those filters switched on, and the same filters chosen by hand are the same address.
//
// scripts/landing-pages.js decides which of these get a page of their own and writes them out for
// crawlers; this file reads the same addresses back into filters, and writes the filters back as
// the address. The slugs, headings and the rule for what counts as a landing view are the same in
// both - src/landing.test.ts runs the two side by side so they can't drift apart.

import { FilterState } from './components/Filters';
import { EMPTY_FILTERS } from './jobFilters';
import { prettyLabel, locationLabel } from './labels';
import { BASE, relativePath } from './routes';
import { Job } from './types';

/** One of the views a landing page stands for. */
export interface View {
  /** "Melbourne, Victoria" - a value of the Job location filter. */
  location?: string;
  /** A value of the Job type filter. */
  type?: string;
  /** Only employers on the Home Affairs accredited sponsor register. */
  sponsor?: boolean;
  /** A value of the Job level filter - "Graduate", "Senior". On its own or in a city. */
  level?: string;
}

/** Roles a view needs before it is worth a page - the same figure the generator uses. */
export const MIN_ROLES = 10;

/** What Dealroom files a role under when it can't say. Never a page. */
const NO_CATEGORY = 'Other';

/** "Marketing & Communication" -> "marketing-and-communication". */
export const slugify = (text: string): string =>
  text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** "Melbourne, Victoria" -> { city: 'Melbourne', state: 'Victoria' }. */
export function splitLocation(location: string): { city: string; state: string } {
  const at = location.lastIndexOf(', ');
  return at === -1
    ? { city: location, state: '' }
    : { city: location.slice(0, at), state: location.slice(at + 2) };
}

const citySlug = (location: string): string => slugify(splitLocation(location).city);

/** The path a view is written as (no base), or null when it isn't a landing view. */
export function viewPath({ location, type, sponsor, level }: View): string | null {
  const city = location ? citySlug(location) : '';
  const kind = type ? slugify(type) : '';
  if (level) {
    // A level is its own axis: alone, or in a city - not also a kind of work or sponsors.
    if (kind || sponsor) return null;
    return city ? `/levels/${slugify(level)}/in/${city}` : `/levels/${slugify(level)}`;
  }
  if (sponsor) {
    if (city && kind) return null;
    if (city) return `/visa-sponsorship/in/${city}`;
    if (kind) return `/visa-sponsorship/roles/${kind}`;
    return '/visa-sponsorship';
  }
  if (city && kind) return `/jobs-in/${city}/${kind}`;
  if (city) return `/jobs-in/${city}`;
  if (kind) return `/roles/${kind}`;
  return null;
}

/** What a view is called - its page's <h1>. */
export function viewHeading({ location, type, sponsor, level }: View): string {
  const city = location ? splitLocation(location).city : '';
  const kind = type ? prettyLabel(type) : level ? prettyLabel(level) : '';
  if (sponsor) {
    if (city) return `Visa sponsorship jobs in ${city}`;
    if (kind) return `${kind} jobs with visa sponsorship`;
    return 'Startup jobs with visa sponsorship in Australia';
  }
  if (city && kind) return `${kind} jobs in ${city}`;
  if (city) return `Startup jobs in ${city}`;
  return `${kind} jobs at Australian startups`;
}

/** The sentence under the heading. The generator's also carries the sponsor share and the pay
 * range, which it works out over the whole board; this is the part the app can say from what is
 * on screen. */
export function viewLead(
  { location, type, sponsor, level }: View,
  roles: number,
  employers: number
) {
  const scope = [
    type || level ? `${prettyLabel((type || level) as string)} ` : '',
    'roles',
    location ? ` in ${locationLabel(location)}` : ' across Australia',
    sponsor ? ' at accredited visa sponsors' : '',
  ].join('');
  const who = employers === 1 ? 'startup or scaleup' : 'startups and scaleups';
  return `${roles.toLocaleString('en-AU')} open ${scope}, at ${employers.toLocaleString('en-AU')} ${who}, for international students and graduates.`;
}

/** Every filter that holds a list - the ones a landing view must leave alone. */
const LIST_FILTERS = (Object.keys(EMPTY_FILTERS) as (keyof FilterState)[]).filter((key) =>
  Array.isArray(EMPTY_FILTERS[key])
);
const VIEW_FILTERS = new Set<keyof FilterState>(['jobLocations', 'types', 'sponsor', 'jobLevels']);

/**
 * The landing view these filters amount to, or null when they are something else.
 *
 * Exactly the view and nothing more: one place, one kind of work, sponsors only, in any
 * combination the pages cover - and no search, pay, level or anything else on top. That is what
 * makes an address and a filter set interchangeable: the address says all of it.
 */
export function viewOf(filters: FilterState, defaulted = ''): View | null {
  const view = viewOfFilters(filters);
  // The city the board started on because of the reader's time zone is a default, not a
  // choice: it is still the home page, not that city's landing page. It becomes one only if
  // the reader picks the city themselves (App clears `defaulted` the moment the location
  // filter is touched).
  if (
    view &&
    defaulted &&
    view.location === defaulted &&
    !view.type &&
    !view.sponsor &&
    !view.level
  ) {
    return null;
  }
  return view;
}

function viewOfFilters(filters: FilterState): View | null {
  const { jobLocations, types, sponsor } = filters;
  const { jobLevels } = filters;
  if (jobLocations.length > 1 || types.length > 1 || sponsor.length > 1) return null;
  if (jobLevels.length > 1) return null;
  if (sponsor.length === 1 && sponsor[0] !== 'yes') return null;
  if (LIST_FILTERS.some((key) => !VIEW_FILTERS.has(key) && (filters[key] as string[]).length)) {
    return null;
  }
  if (
    filters.query.trim() ||
    filters.postedWithinDays ||
    filters.salaryMin ||
    filters.salaryMax ||
    filters.minRating
  ) {
    return null;
  }

  const view: View = {};
  if (jobLocations.length) {
    if (!jobLocations[0]) return null;
    view.location = jobLocations[0];
  }
  if (types.length) {
    if (!types[0] || types[0] === NO_CATEGORY) return null;
    view.type = types[0];
  }
  if (sponsor.length) view.sponsor = true;
  if (jobLevels.length) {
    if (!jobLevels[0]) return null;
    view.level = jobLevels[0];
  }
  return viewPath(view) ? view : null;
}

/** The filters a view is. */
export function filtersOf(view: View): FilterState {
  return {
    ...EMPTY_FILTERS,
    jobLocations: view.location ? [view.location] : [],
    types: view.type ? [view.type] : [],
    sponsor: view.sponsor ? ['yes'] : [],
    jobLevels: view.level ? [view.level] : [],
  };
}

/** The values the two filters can take, once the board has loaded. */
export interface ViewOptions {
  jobLocations: string[];
  types: string[];
  jobLevels: string[];
}

interface Segments {
  city?: string;
  type?: string;
  level?: string;
  sponsor: boolean;
}

/** The parts of a landing address, or null when the path isn't shaped like one. */
function segmentsOf(pathname: string): Segments | null {
  const parts = relativePath(pathname)
    .split('/')
    .filter(Boolean)
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    });
  const [first, second, third] = parts;

  if (first === 'jobs-in' && second && parts.length <= 3) {
    return { city: second, type: third, sponsor: false };
  }
  if (first === 'roles' && second && parts.length === 2) return { type: second, sponsor: false };
  if (first === 'levels' && second) {
    if (parts.length === 2) return { level: second, sponsor: false };
    if (parts.length === 4 && third === 'in')
      return { level: second, city: parts[3], sponsor: false };
  }
  if (first === 'visa-sponsorship') {
    if (parts.length === 1) return { sponsor: true };
    if (second === 'in' && third && parts.length === 3) return { city: third, sponsor: true };
    if (second === 'roles' && third && parts.length === 3) return { type: third, sponsor: true };
  }
  return null;
}

/** Whether the path is shaped like a landing address - before the board is loaded to say if it is
 * one that exists. */
export const isLandingPath = (pathname: string): boolean => segmentsOf(pathname) !== null;

let known: ViewOptions | null = null;

/** The board's options, kept so an address can be read into filters from anywhere - the back
 * button included - once they exist. */
export function rememberViewOptions(options: ViewOptions): void {
  known = options;
}

/**
 * The filters a landing address stands for, or null when the path isn't one, or names a place or
 * kind of work the board hasn't got.
 */
export function filtersForPath(
  pathname: string,
  options: ViewOptions | null = known
): FilterState | null {
  const segments = segmentsOf(pathname);
  if (!segments || !options) return null;

  const view: View = {};
  if (segments.city) {
    const location = options.jobLocations.find(
      (value) => value && citySlug(value) === segments.city
    );
    if (!location) return null;
    view.location = location;
  }
  if (segments.type) {
    const type = options.types.find((value) => value && slugify(value) === segments.type);
    if (!type || type === NO_CATEGORY) return null;
    view.type = type;
  }
  if (segments.level) {
    const level = options.jobLevels.find((value) => value && slugify(value) === segments.level);
    if (!level) return null;
    view.level = level;
  }
  if (segments.sponsor) view.sponsor = true;

  // A path like /jobs-in/sydney/sales/extra never gets here; one that names a view the pages
  // don't cover (there is no sponsors-in-a-city-of-a-kind-of-work) is turned away here.
  return viewPath(view) ? filtersOf(view) : null;
}

/** The address (with the base) for a view. */
export const pathForView = (view: View): string | null => {
  const path = viewPath(view);
  return path ? `${BASE}${path}` : null;
};

/** A link into a landing page, with how many roles are behind it. */
export interface BrowseLink {
  label: string;
  path: string;
  count: number;
}

const BROWSE_LIMIT = 12;

/**
 * The landing pages the board can offer, as links: cities, kinds of work, and the sponsors - each
 * only where there are enough roles to be worth a page.
 */
/** Seniority, lowest first - the order levels are listed in. The generator has the same list. */
export const LEVEL_ORDER = [
  'Internship',
  'Graduate',
  'Junior',
  'Mid',
  'Senior',
  'Lead',
  'Director',
  'Executive',
];

export function browseLinks(jobs: Job[]): {
  cities: BrowseLink[];
  types: BrowseLink[];
  levels: BrowseLink[];
  sponsors: BrowseLink[];
} {
  const tally = (pick: (job: Job) => string | undefined) => {
    const counts = new Map<string, number>();
    for (const job of jobs) {
      const key = pick(job);
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts)
      .filter(([, n]) => n >= MIN_ROLES)
      .sort((a, b) => b[1] - a[1]);
  };
  const link = (view: View, label: string, count: number): BrowseLink | null => {
    const path = pathForView(view);
    return path ? { label, path, count } : null;
  };
  const present = (links: (BrowseLink | null)[]) =>
    links.filter((l): l is BrowseLink => l !== null).slice(0, BROWSE_LIMIT);

  // A role at two levels counts at both, as the Job level filter has it.
  const levelCounts = new Map<string, number>();
  for (const job of jobs) {
    for (const level of job.jobLevels) levelCounts.set(level, (levelCounts.get(level) ?? 0) + 1);
  }

  const sponsored = jobs.filter((job) => job.company.accreditedSponsor === true);
  const sponsorCities = new Map<string, number>();
  for (const job of sponsored) {
    if (job.location) sponsorCities.set(job.location, (sponsorCities.get(job.location) ?? 0) + 1);
  }

  return {
    cities: present(
      tally((job) => job.location).map(([location, n]) =>
        link({ location }, splitLocation(location).city, n)
      )
    ),
    types: present(
      tally((job) => (job.type === NO_CATEGORY ? '' : job.type)).map(([type, n]) =>
        link({ type }, prettyLabel(type), n)
      )
    ),
    levels: present(
      Array.from(levelCounts)
        .filter(([, n]) => n >= MIN_ROLES)
        .sort((a, b) => LEVEL_ORDER.indexOf(a[0]) - LEVEL_ORDER.indexOf(b[0]))
        .map(([level, n]) => link({ level }, prettyLabel(level), n))
    ),
    sponsors: present([
      sponsored.length >= MIN_ROLES
        ? link({ sponsor: true }, 'All visa sponsors', sponsored.length)
        : null,
      ...Array.from(sponsorCities)
        .filter(([, n]) => n >= MIN_ROLES)
        .sort((a, b) => b[1] - a[1])
        .map(([location, n]) =>
          link({ location, sponsor: true }, `Sponsors in ${splitLocation(location).city}`, n)
        ),
    ]),
  };
}
