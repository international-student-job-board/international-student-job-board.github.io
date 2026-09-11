import {
  companyViewToParams,
  companyViewFromParams,
  hasCompanyFilterParams,
  pruneCompanyFilters,
} from './filterParams';
import { CompanyFilters, CompanyView, DEFAULT_COMPANY_VIEW, NO_COMPANY_FILTERS } from './companies';

const view = (
  over: Partial<Omit<CompanyView, 'filters'>> & { filters?: Partial<CompanyFilters> } = {}
): CompanyView => ({
  ...DEFAULT_COMPANY_VIEW,
  ...over,
  filters: { ...NO_COMPANY_FILTERS, ...(over.filters ?? {}) },
});

const roundTrip = (v: CompanyView) =>
  companyViewFromParams(new URLSearchParams(companyViewToParams(v).toString()), DEFAULT_COMPANY_VIEW);

test('the default view writes no query', () => {
  expect(companyViewToParams(DEFAULT_COMPANY_VIEW).toString()).toBe('');
});

test('a filtered, searched, sorted view round-trips', () => {
  const v = view({
    query: 'health',
    filters: { states: ['Victoria'], industries: ['fintech'], sponsor: ['yes'] },
    minRating: 4,
    sort: 'name',
  });
  expect(roundTrip(v)).toEqual(v);
});

test('readable parameter names, shared with the jobs board where they match', () => {
  const qs = companyViewToParams(
    view({ filters: { states: ['Victoria'], industries: ['fintech'] }, sort: 'name' })
  ).toString();
  expect(qs).toContain('state=Victoria');
  expect(qs).toContain('industry=fintech');
  expect(qs).toContain('sort=name');
});

test('the default sort is left out of the URL', () => {
  expect(companyViewToParams(view({ sort: 'openings' })).toString()).not.toContain('sort=');
});

test('an unknown sort falls back to the base', () => {
  const out = companyViewFromParams(new URLSearchParams('sort=sideways'), DEFAULT_COMPANY_VIEW);
  expect(out.sort).toBe('openings');
});

test('"only unrated" round-trips and junk rating is dropped', () => {
  expect(roundTrip(view({ minRating: -1 })).minRating).toBe(-1);
  expect(companyViewFromParams(new URLSearchParams('rating=9'), DEFAULT_COMPANY_VIEW).minRating).toBe(0);
});

test('hasCompanyFilterParams tells a shared link from a bare visit', () => {
  expect(hasCompanyFilterParams(new URLSearchParams(''))).toBe(false);
  expect(hasCompanyFilterParams(new URLSearchParams('utm=x'))).toBe(false);
  expect(hasCompanyFilterParams(new URLSearchParams('industry=fintech'))).toBe(true);
  expect(hasCompanyFilterParams(new URLSearchParams('sort=name'))).toBe(true);
});

test('pruneCompanyFilters keeps only values the data offers', () => {
  const pruned = pruneCompanyFilters(
    { ...NO_COMPANY_FILTERS, states: ['Victoria', 'Nowhere'], industries: ['fintech'] },
    { states: ['Victoria', 'Queensland'], industries: ['fintech'] }
  );
  expect(pruned.states).toEqual(['Victoria']);
  expect(pruned.industries).toEqual(['fintech']);
});
