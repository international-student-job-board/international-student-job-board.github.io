import {
  filtersToParams,
  filtersFromParams,
  hasFilterParams,
  pruneToOptions,
} from './filterParams';
import { FilterState } from './components/Filters';

const EMPTY: FilterState = {
  query: '',
  companies: [],
  states: [],
  types: [],
  employmentTypes: [],
  jobLevels: [],
  workArrangements: [],
  educationLevels: [],
  cities: [],
  industries: [],
  companyTypes: [],
  growthStages: [],
  hqCities: [],
  anzscos: [],
  invitedOccupations: [],
  unitGroups: [],
  oscas: [],
  occupationLists: [],
  pathwayVisas: [],
  sponsor: [],
  students: [],
  postedWithinDays: 0,
  salaryMin: 0,
  salaryMax: 0,
  minRating: 0,
};

const roundTrip = (f: FilterState) =>
  filtersFromParams(new URLSearchParams(filtersToParams(f).toString()), EMPTY);

test('an untouched filter writes no query at all', () => {
  expect(filtersToParams(EMPTY).toString()).toBe('');
});

test('a filtered view round-trips through the query string', () => {
  const f: FilterState = {
    ...EMPTY,
    query: 'react',
    states: ['Victoria', 'New South Wales'],
    jobLevels: ['Senior'],
    workArrangements: ['Remote'],
    anzscos: ['261313'],
    sponsor: ['yes'],
    postedWithinDays: 7,
    salaryMin: 100000,
    salaryMax: 180000,
    minRating: 4,
  };
  expect(roundTrip(f)).toEqual(f);
});

test('readable parameter names', () => {
  const qs = filtersToParams({
    ...EMPTY,
    states: ['Victoria'],
    jobLevels: ['Senior'],
    salaryMin: 90000,
    minRating: 3.5,
  }).toString();
  expect(qs).toContain('state=Victoria');
  expect(qs).toContain('level=Senior');
  expect(qs).toContain('salarymin=90000');
  expect(qs).toContain('rating=3.5');
});

test('the "not specified" choice survives the trip', () => {
  const f = { ...EMPTY, workArrangements: [''] };
  const qs = filtersToParams(f).toString();
  expect(qs).toBe('arrangement=%28none%29');
  expect(roundTrip(f)).toEqual(f);
});

test('the "only unrated" rating choice round-trips', () => {
  const f = { ...EMPTY, minRating: -1 };
  expect(roundTrip(f)).toEqual(f);
});

test('junk and out-of-range params are dropped, not honoured', () => {
  const params = new URLSearchParams('state=Victoria&nonsense=1&posted=999&rating=7&salarymin=-5');
  const out = filtersFromParams(params, EMPTY);
  expect(out.states).toEqual(['Victoria']);
  expect(out.postedWithinDays).toBe(0);
  expect(out.minRating).toBe(0);
  expect(out.salaryMin).toBe(0);
});

test('a min above the max is dropped so the range still makes sense', () => {
  const out = filtersFromParams(new URLSearchParams('salarymin=200000&salarymax=120000'), EMPTY);
  expect(out.salaryMin).toBe(0);
  expect(out.salaryMax).toBe(120000);
});

test('hasFilterParams tells a shared link from a bare visit', () => {
  expect(hasFilterParams(new URLSearchParams(''))).toBe(false);
  expect(hasFilterParams(new URLSearchParams('ref=twitter'))).toBe(false);
  expect(hasFilterParams(new URLSearchParams('state=Victoria'))).toBe(true);
  expect(hasFilterParams(new URLSearchParams('q=react'))).toBe(true);
});

test('pruneToOptions keeps only values the data can offer', () => {
  const f = { ...EMPTY, companies: ['Acme', 'Ghost Co'], states: ['Victoria'] };
  const pruned = pruneToOptions(f, {
    ...({} as Record<string, string[]>),
    companies: ['Acme'],
    states: ['Victoria', 'Queensland'],
  } as never);
  expect(pruned.companies).toEqual(['Acme']);
  expect(pruned.states).toEqual(['Victoria']);
});

test('pruneToOptions returns the same object when nothing needs dropping', () => {
  const f = { ...EMPTY, states: ['Victoria'] };
  const same = pruneToOptions(f, { states: ['Victoria', 'Queensland'] } as never);
  expect(same).toBe(f);
});
