// The landing pages are written twice - as files, by scripts/landing-pages.js, for crawlers, and as
// the app's own routing, by src/landing.ts. These tests run the two side by side: an address that
// means one thing to a crawler and another to the app would send a reader to the wrong place.

import { EMPTY_FILTERS } from './jobFilters';
import {
  browseLinks,
  filtersForPath,
  filtersOf,
  isLandingPath,
  slugify,
  viewHeading,
  viewOf,
  viewPath,
  View,
} from './landing';
import { prettyLabel } from './labels';
import { Job } from './types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const generator = require('../scripts/landing-pages.js');

const LOCATIONS = [
  'Melbourne, Victoria',
  'Sydney, New South Wales',
  'Canberra, Australian Capital Territory',
  'Gold Coast, Queensland',
];
// What Dealroom files roles under - including the spelling variety the labels have to iron out.
const TYPES = [
  'Marketing & Communication',
  'Backend development',
  'CSM & Support',
  'Data Science & Engineering',
  'C-level',
  'iOS Development',
  'Sales',
];

const VIEWS: View[] = [
  { location: LOCATIONS[0] },
  { type: TYPES[0] },
  { location: LOCATIONS[1], type: TYPES[1] },
  { sponsor: true },
  { sponsor: true, location: LOCATIONS[2] },
  { sponsor: true, type: TYPES[2] },
  { sponsor: true, location: LOCATIONS[0], type: TYPES[0] },
  { level: 'Graduate' },
  { level: 'Senior', location: LOCATIONS[1] },
  // Not landing views: a level never combines with a kind of work or with sponsors.
  { level: 'Graduate', type: TYPES[0] },
  { level: 'Graduate', sponsor: true },
  {},
];

describe('the app and the page generator agree', () => {
  test.each(VIEWS)('the address for %j', (view) => {
    expect(viewPath(view)).toBe(generator.pathFor(view));
  });

  test.each(VIEWS.filter((v) => viewPath(v)))('the heading for %j', (view) => {
    expect(viewHeading(view)).toBe(generator.headingFor(view));
  });

  test.each(TYPES)('a kind of work is written the same: %s', (type) => {
    expect(generator.typeLabel(type)).toBe(prettyLabel(type));
    expect(slugify(type)).toBe(generator.slugify(type));
  });

  test('cities are slugged from the city alone, not its state', () => {
    for (const location of LOCATIONS) {
      expect(viewPath({ location })).toBe(`/jobs-in/${generator.citySlug(location)}`);
    }
    expect(viewPath({ location: 'Sydney, New South Wales' })).toBe('/jobs-in/sydney');
  });
});

describe('a view and its filters are the same thing', () => {
  test.each(VIEWS.filter((v) => viewPath(v)))('%j survives the round trip', (view) => {
    expect(viewOf(filtersOf(view))).toEqual(view);
  });

  test('anything else switched on makes it a search, not a landing view', () => {
    const base = filtersOf({ location: LOCATIONS[0] });
    expect(viewOf(base)).toEqual({ location: LOCATIONS[0] });
    expect(viewOf({ ...base, query: 'react' })).toBeNull();
    expect(viewOf({ ...base, employmentTypes: ['Full-time'] })).toBeNull();
    expect(viewOf({ ...base, postedWithinDays: 7 })).toBeNull();
    expect(viewOf({ ...base, salaryMin: 40000 })).toBeNull();
    expect(viewOf({ ...base, students: ['yes'] })).toBeNull();
  });

  test('two places, or two kinds of work, is not one view', () => {
    expect(viewOf({ ...EMPTY_FILTERS, jobLocations: [LOCATIONS[0], LOCATIONS[1]] })).toBeNull();
    expect(viewOf({ ...EMPTY_FILTERS, types: [TYPES[0], TYPES[1]] })).toBeNull();
  });

  test('"no location", the sponsors-say-no answer and the uncategorised type are never views', () => {
    expect(viewOf({ ...EMPTY_FILTERS, jobLocations: [''] })).toBeNull();
    expect(viewOf({ ...EMPTY_FILTERS, sponsor: ['no'] })).toBeNull();
    expect(viewOf({ ...EMPTY_FILTERS, types: ['Other'] })).toBeNull();
  });

  test('a place and a kind of work and sponsors together is beyond a page', () => {
    expect(viewOf(filtersOf({ location: LOCATIONS[0], type: TYPES[0], sponsor: true }))).toBeNull();
  });

  test('no filters at all is the board, not a landing page', () => {
    expect(viewOf(EMPTY_FILTERS)).toBeNull();
  });
});

describe('reading an address back into filters', () => {
  const OPTIONS = {
    jobLocations: [...LOCATIONS, ''],
    types: [...TYPES, 'Other', ''],
    jobLevels: ['Graduate', 'Senior', 'Mid'],
  };

  test.each([
    ['/jobs-in/melbourne', { location: 'Melbourne, Victoria' }],
    ['/jobs-in/canberra', { location: 'Canberra, Australian Capital Territory' }],
    ['/roles/marketing-and-communication', { type: 'Marketing & Communication' }],
    [
      '/jobs-in/sydney/backend-development',
      { location: LOCATIONS[1], type: 'Backend development' },
    ],
    ['/visa-sponsorship', { sponsor: true }],
    ['/visa-sponsorship/in/gold-coast', { sponsor: true, location: 'Gold Coast, Queensland' }],
    ['/visa-sponsorship/roles/c-level', { sponsor: true, type: 'C-level' }],
    ['/jobs-in/melbourne/', { location: 'Melbourne, Victoria' }],
    ['/levels/graduate', { level: 'Graduate' }],
    ['/levels/senior/in/sydney', { level: 'Senior', location: LOCATIONS[1] }],
  ] as [string, View][])('%s', (path, view) => {
    expect(filtersForPath(path, OPTIONS)).toEqual(filtersOf(view));
  });

  test('and back again: the filters write the address they were read from', () => {
    for (const path of [
      '/jobs-in/sydney',
      '/roles/sales',
      '/visa-sponsorship/in/melbourne',
      '/levels/graduate',
      '/levels/mid/in/melbourne',
    ]) {
      const filters = filtersForPath(path, OPTIONS);
      expect(filters).not.toBeNull();
      expect(viewPath(viewOf(filters!)!)).toBe(path);
    }
  });

  test('a place or kind of work the board does not have is not an address', () => {
    expect(filtersForPath('/jobs-in/atlantis', OPTIONS)).toBeNull();
    expect(filtersForPath('/roles/underwater-basket-weaving', OPTIONS)).toBeNull();
    expect(filtersForPath('/roles/other', OPTIONS)).toBeNull();
    expect(filtersForPath('/levels/wizard', OPTIONS)).toBeNull();
  });

  test('a shape the pages do not cover is not an address', () => {
    expect(filtersForPath('/jobs-in/sydney/sales/extra', OPTIONS)).toBeNull();
    expect(filtersForPath('/roles/sales/sydney', OPTIONS)).toBeNull();
    expect(filtersForPath('/visa-sponsorship/sydney', OPTIONS)).toBeNull();
    expect(filtersForPath('/levels/graduate/sydney', OPTIONS)).toBeNull();
    expect(filtersForPath('/levels/graduate/in/sydney/extra', OPTIONS)).toBeNull();
    expect(filtersForPath('/companies', OPTIONS)).toBeNull();
    expect(filtersForPath('/jobs/123', OPTIONS)).toBeNull();
    expect(filtersForPath('/', OPTIONS)).toBeNull();
  });

  test('with no options yet there is nothing to resolve against', () => {
    expect(filtersForPath('/jobs-in/melbourne', null)).toBeNull();
    // ...but the shape alone is enough to know the address is a landing page's.
    expect(isLandingPath('/jobs-in/melbourne')).toBe(true);
    expect(isLandingPath('/jobs/5')).toBe(false);
    expect(isLandingPath('/companies')).toBe(false);
  });
});

/** A role, for the generator - which reads the CSV's fields, not the app's Job. */
const csvRole = (over: Record<string, unknown>) => ({
  company: 'Acme',
  location: 'Melbourne, Victoria',
  type: 'Sales',
  sponsor: false,
  salaryMid: 0,
  ...over,
});

const many = (n: number, over: Record<string, unknown>) =>
  Array.from({ length: n }, (_, i) => csvRole({ company: `Co ${i}`, ...over }));

const pathsOf = (pages: { path: string }[]) => pages.map((p) => p.path);

describe('which pages there are', () => {
  test('a view needs ten roles', () => {
    const pages = generator.landingPages([
      ...many(9, { location: 'Perth, Western Australia' }),
      ...many(10, { location: 'Adelaide, South Australia', type: 'Legal' }),
    ]);
    const paths = pathsOf(pages);
    expect(paths).toContain('/jobs-in/adelaide');
    expect(paths).toContain('/roles/legal');
    expect(paths).toContain('/jobs-in/adelaide/legal');
    expect(paths.some((p) => p.includes('perth'))).toBe(false);
  });

  test('uncategorised roles never make a page of their own', () => {
    const pages = generator.landingPages(many(50, { type: 'Other' }));
    expect(pathsOf(pages)).toEqual(['/jobs-in/melbourne']);
  });

  test('sponsors get their own pages, only where there are ten of them', () => {
    const pages = generator.landingPages([
      ...many(12, { sponsor: true }),
      ...many(30, { sponsor: false, location: 'Sydney, New South Wales' }),
    ]);
    const paths = pathsOf(pages);
    expect(paths).toContain('/visa-sponsorship');
    expect(paths).toContain('/visa-sponsorship/in/melbourne');
    expect(paths).not.toContain('/visa-sponsorship/in/sydney');
  });

  test('two places with the same name do not share an address', () => {
    const pages = generator.landingPages([
      ...many(20, { location: 'Newcastle, New South Wales' }),
      ...many(12, { location: 'Newcastle, Queensland' }),
    ]);
    const cityPages = pages.filter((p: { path: string }) => p.path === '/jobs-in/newcastle');
    expect(cityPages).toHaveLength(1);
    expect(cityPages[0].location).toBe('Newcastle, New South Wales');
  });

  test('every page says how many roles are on it, and it is true', () => {
    const roles = [...many(14, {}), ...many(11, { location: 'Sydney, New South Wales' })];
    for (const page of generator.landingPages(roles)) {
      expect(page.stats.count).toBe(page.jobs.length);
      expect(page.lead).toContain(`${page.stats.count.toLocaleString('en-AU')} open`);
    }
  });

  test('the sponsor share and pay range are worked out over that page, not the whole board', () => {
    const roles = [
      ...many(10, { sponsor: true, salaryMid: 100000 }),
      ...many(10, { sponsor: false, salaryMid: 60000, location: 'Sydney, New South Wales' }),
    ];
    const pages = generator.landingPages(roles);
    const melbourne = pages.find((p: { path: string }) => p.path === '/jobs-in/melbourne');
    const sydney = pages.find((p: { path: string }) => p.path === '/jobs-in/sydney');
    expect(melbourne.stats.sponsorPercent).toBe(100);
    expect(sydney.stats.sponsorPercent).toBe(0);
    expect(melbourne.lead).toContain('median A$100k');
    expect(sydney.lead).toContain('median A$60k');
    // No sponsors, so no sentence about them.
    expect(sydney.lead).not.toMatch(/sponsor register/);
  });

  test("a role at two levels is on both levels' pages", () => {
    const roles = many(12, { levels: ['Mid', 'Senior'] });
    const paths = pathsOf(generator.landingPages(roles));
    expect(paths).toContain('/levels/mid');
    expect(paths).toContain('/levels/senior');
    expect(paths).toContain('/levels/mid/in/melbourne');
  });

  test('a level needs ten roles, alone or in a city', () => {
    const roles = [
      ...many(12, { levels: ['Graduate'] }),
      ...many(6, { levels: ['Graduate'], location: 'Perth, Western Australia' }),
    ];
    const paths = pathsOf(generator.landingPages(roles));
    expect(paths).toContain('/levels/graduate');
    expect(paths).toContain('/levels/graduate/in/melbourne');
    expect(paths.some((p) => p.includes('/levels/graduate/in/perth'))).toBe(false);
  });

  test('levels are listed lowest seniority first', () => {
    const roles = [
      ...many(12, { levels: ['Senior'] }),
      ...many(12, { levels: ['Graduate'] }),
      ...many(12, { levels: ['Lead'] }),
    ];
    const levels = generator
      .landingPages(roles)
      .filter((p: { level?: string; location?: string }) => p.level && !p.location)
      .map((p: { level: string }) => p.level);
    expect(levels).toEqual(['Graduate', 'Senior', 'Lead']);
  });

  test('pay is only quoted when enough roles state it', () => {
    const pages = generator.landingPages([
      ...many(4, { salaryMid: 90000 }),
      ...many(8, { salaryMid: 0 }),
    ]);
    expect(pages[0].lead).not.toMatch(/Pay typically/);
  });
});

describe('the links the board offers', () => {
  const job = (over: Partial<Job> & { sponsor?: boolean }) =>
    ({
      location: 'Melbourne, Victoria',
      type: 'Sales',
      jobLevels: [],
      company: { accreditedSponsor: over.sponsor ?? false },
      ...over,
    }) as unknown as Job;

  test('cities, kinds of work and sponsors - each only with ten roles behind it', () => {
    const jobs = [
      ...Array.from({ length: 12 }, () => job({ sponsor: true })),
      ...Array.from({ length: 9 }, () =>
        job({ location: 'Perth, Western Australia', type: 'Legal' })
      ),
    ];
    const links = browseLinks(jobs);
    expect(links.cities.map((l) => l.path)).toEqual(['/jobs-in/melbourne']);
    expect(links.types.map((l) => l.path)).toEqual(['/roles/sales']);
    expect(links.sponsors.map((l) => l.path)).toEqual([
      '/visa-sponsorship',
      '/visa-sponsorship/in/melbourne',
    ]);
    expect(links.cities[0]).toMatchObject({ label: 'Melbourne', count: 12 });
  });

  test('levels, lowest seniority first, counting a two-level role at both', () => {
    const jobs = [
      ...Array.from({ length: 11 }, () => job({ jobLevels: ['Mid', 'Senior'] })),
      ...Array.from({ length: 10 }, () => job({ jobLevels: ['Graduate'] })),
    ];
    expect(browseLinks(jobs).levels.map((l) => [l.path, l.count])).toEqual([
      ['/levels/graduate', 10],
      ['/levels/mid', 11],
      ['/levels/senior', 11],
    ]);
  });

  test('nothing when there are too few roles to make a page', () => {
    expect(browseLinks([job({}), job({})])).toEqual({
      cities: [],
      types: [],
      levels: [],
      sponsors: [],
    });
  });
});
