import { computeFilterOptions, UNSPECIFIED, EMPTY_FILTERS, cutoff, matches } from './jobFilters';
import { daysBeforeISO } from './format';
import { setConstants } from './constants';
import { Job } from './types';

const job = (over: Partial<Job> = {}): Job =>
  ({
    id: '7',
    title: 'Senior Applied AI Engineer',
    type: 'Backend development',
    occupationNames: [],
    anzsco2022: [],
    anzsco2013: [],
    anzscoUnitGroups: [],
    anzscoUnitGroupTitles: [],
    oscaCodes: [],
    oscaNames: [],
    city: 'Melbourne',
    state: 'Victoria',
    country: 'Australia',
    posted: '2026-09-07',
    applyUrl: 'https://acme.test/apply',
    employmentType: '',
    jobLevels: [],
    workArrangements: [],
    educationLevels: [],
    salary: {
      base: { minAud: 120000, maxAud: 158000, currency: 'AUD' },
      source: 'advert',
      sourceUrl: '',
      isEstimate: false,
    },
    company: {
      name: 'Acme',
      state: 'Victoria',
      segment: '',
      types: [],
      industries: [],
      website: 'https://acme.test',
      growthStage: '',
      employees: '',
      hqCity: 'Melbourne',
      hqAddress: '',
      tagline: '',
      linkedin: '',
      openings: 1,
      accreditedSponsor: undefined,
      hiresInternationalStudents: undefined,
    },
    ...over,
  }) as Job;

beforeEach(() => {
  setConstants({
    jobLevel: ['Internship', 'Graduate', 'Junior', 'Mid', 'Senior', 'Lead'],
    type: [],
    arrangement: [],
    educationLevel: [
      'Diploma',
      'Certification',
      'Bachelor',
      'Final year of degree',
      'Master',
      'Graduate Diploma',
      'Graduate Certification',
      'PhD',
    ],
    assessment: [],
    skills: [],
  });
});

test('job level options follow the hierarchy in content/constants.json, not A-to-Z', () => {
  const jobs = [
    job({ id: '1', jobLevels: ['Senior'] }),
    job({ id: '2', jobLevels: ['Junior'] }),
    job({ id: '3', jobLevels: ['Internship'] }),
    job({ id: '4', jobLevels: ['Lead'] }),
  ];
  expect(computeFilterOptions(jobs).jobLevels).toEqual(['Internship', 'Junior', 'Senior', 'Lead']);
});

test('a job level the hierarchy does not name sorts after every known rung', () => {
  const jobs = [
    job({ id: '1', jobLevels: ['Senior'] }),
    job({ id: '2', jobLevels: ['Contractor'] }), // not in content/constants.json
    job({ id: '3', jobLevels: ['Internship'] }),
  ];
  expect(computeFilterOptions(jobs).jobLevels).toEqual(['Internship', 'Senior', 'Contractor']);
});

test('a job spanning two levels (e.g. LinkedIn\'s "Mid-Senior level") matches a filter on either', () => {
  const jobs = [job({ id: '1', jobLevels: ['Mid', 'Senior'] })];
  expect(computeFilterOptions(jobs).jobLevels).toEqual(['Mid', 'Senior']);
});

test('education options follow the hierarchy, and roles with none sort last as unspecified', () => {
  const jobs = [
    job({ id: '1', educationLevels: ['PhD'] }),
    job({ id: '2', educationLevels: ['Bachelor'] }),
    job({ id: '3', educationLevels: [] }),
  ];
  expect(computeFilterOptions(jobs).educationLevels).toEqual(['Bachelor', 'PhD', UNSPECIFIED]);
});

describe('the "posted within" filter', () => {
  // Roles are dated to the day, with no time. Everything below is read at midday on the 19th.
  beforeEach(() => {
    jest.useFakeTimers('modern');
    jest.setSystemTime(new Date(2026, 8, 19, 12, 0, 0)); // local time, as todayISO reads it
  });
  afterEach(() => jest.useRealTimers());

  const within = (days: number, posted: string) => {
    const filters = { ...EMPTY_FILTERS, postedWithinDays: days };
    return matches(job({ posted }), filters, cutoff(filters));
  };

  test('"last 24 hours" includes a role dated yesterday, however late in the day it is', () => {
    // The bug: yesterday is midnight yesterday, which is more than 24 hours before midday
    // today, so a rolling 24-hour window dropped it - and dropped every role the day before,
    // leaving the filter empty on data that was a day old.
    expect(within(1, '2026-09-19')).toBe(true);
    expect(within(1, '2026-09-18')).toBe(true);
  });

  test('it does not reach back further than the window asked for', () => {
    expect(within(1, '2026-09-17')).toBe(false);
    expect(within(7, '2026-09-12')).toBe(true);
    expect(within(7, '2026-09-11')).toBe(false);
  });

  test('a role dated in the future is not excluded by it', () => {
    expect(within(1, '2026-09-20')).toBe(true);
  });

  test('a role with no readable date drops out once the filter is on', () => {
    expect(within(7, '')).toBe(false);
    expect(within(7, 'yesterday')).toBe(false);
  });

  test('with the filter off nothing is cut', () => {
    expect(cutoff(EMPTY_FILTERS)).toBe(0);
  });

  test('the window is the same at any hour of the day', () => {
    for (const hour of [0, 6, 23]) {
      jest.setSystemTime(new Date(2026, 8, 19, hour, 30, 0));
      expect(within(1, '2026-09-18')).toBe(true);
      expect(within(1, '2026-09-17')).toBe(false);
    }
  });
});

test('daysBeforeISO counts calendar days across month ends and leap days', () => {
  expect(daysBeforeISO('2026-10-01', 1)).toBe('2026-09-30');
  expect(daysBeforeISO('2028-03-01', 1)).toBe('2028-02-29');
  expect(daysBeforeISO('nonsense', 1)).toBe('');
});

describe('searching', () => {
  const role = (over: Record<string, unknown>) =>
    ({
      ...job({}),
      ...over,
    }) as Job;
  const found = (query: string, j: Job) => matches(j, { ...EMPTY_FILTERS, query }, 0);

  const target = role({
    title: 'Marketing Coordinator',
    type: 'Marketing & Communication',
    location: 'Sydney, New South Wales',
    city: 'Sydney',
    jobLevels: ['Graduate'],
    workArrangements: ['Remote'],
    employmentType: 'Full-time',
  });

  test('every word has to match, in any order', () => {
    expect(found('marketing sydney', target)).toBe(true);
    expect(found('sydney marketing', target)).toBe(true);
    expect(found('graduate marketing sydney', target)).toBe(true);
  });

  test('a word the role does not have rules it out', () => {
    expect(found('marketing melbourne', target)).toBe(false);
    expect(found('senior marketing', target)).toBe(false);
  });

  test('level, arrangement and kind of work are searchable', () => {
    expect(found('graduate', target)).toBe(true);
    expect(found('remote', target)).toBe(true);
    expect(found('communication', target)).toBe(true);
    expect(found('full-time', target)).toBe(true);
  });

  test('a partial word still matches, as it always did', () => {
    expect(found('market', target)).toBe(true);
  });

  test('extra spaces and capitals do not matter', () => {
    expect(found('  GRADUATE   Marketing ', target)).toBe(true);
  });

  test('an empty search matches everything', () => {
    expect(found('   ', target)).toBe(true);
  });
});
