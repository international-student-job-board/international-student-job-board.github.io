/**
 * The filter state <-> the URL query string.
 *
 * Every applied filter shows up as a query parameter, so a filtered view can be
 * bookmarked, shared, or reached with the browser's back button. Reading is
 * lenient: unknown params are ignored and out-of-range scalars fall back to
 * "off", so a hand-edited or stale link still lands somewhere sensible.
 */
import { FilterState, FilterListKey, POSTED_WINDOWS } from './components/Filters';
import { RATING_VALUES } from './components/RatingFilter';
import {
  CompanyFilterKey,
  CompanyFilters,
  CompanySort,
  CompanyView,
  NO_COMPANY_FILTERS,
} from './companies';

/** The list-valued filters, and the short query name each one uses. */
const LIST_PARAM: Record<FilterListKey, string> = {
  companies: 'company',
  states: 'state',
  types: 'type',
  employmentTypes: 'employment',
  jobLevels: 'level',
  workArrangements: 'arrangement',
  educationLevels: 'education',
  cities: 'city',
  industries: 'industry',
  companyTypes: 'model',
  growthStages: 'stage',
  hqCities: 'hq',
  anzscos: 'anzsco',
  invitedOccupations: 'invited',
  unitGroups: 'unitgroup',
  oscas: 'osca',
  occupationLists: 'list',
  pathwayVisas: 'visa',
  sponsor: 'sponsor',
  students: 'students',
};

const LIST_KEYS = Object.keys(LIST_PARAM) as FilterListKey[];

/** The scalar filters. */
const QUERY_PARAM = 'q';
const POSTED_PARAM = 'posted';
const SALARY_MIN_PARAM = 'salarymin';
const SALARY_MAX_PARAM = 'salarymax';
const RATING_PARAM = 'rating';

/** A filter can ask for "roles that don't say"; in a URL that blank is this. */
const BLANK_TOKEN = '(none)';

const encodeValue = (value: string) => (value === '' ? BLANK_TOKEN : value);
const decodeValue = (value: string) => (value === BLANK_TOKEN ? '' : value);

const toInt = (value: string | null) => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Every filter that is doing something, written as query parameters. */
export function filtersToParams(filters: FilterState): URLSearchParams {
  const params = new URLSearchParams();

  for (const key of LIST_KEYS) {
    for (const value of filters[key]) params.append(LIST_PARAM[key], encodeValue(value));
  }

  if (filters.query.trim()) params.set(QUERY_PARAM, filters.query.trim());
  if (filters.postedWithinDays > 0) params.set(POSTED_PARAM, String(filters.postedWithinDays));
  if (filters.salaryMin > 0) params.set(SALARY_MIN_PARAM, String(filters.salaryMin));
  if (filters.salaryMax > 0) params.set(SALARY_MAX_PARAM, String(filters.salaryMax));
  if (filters.minRating !== 0) params.set(RATING_PARAM, String(filters.minRating));

  return params;
}

/** `?state=Victoria&level=Senior` as a whole filter state, merged onto `base`. */
export function filtersFromParams(params: URLSearchParams, base: FilterState): FilterState {
  const next: FilterState = { ...base };

  for (const key of LIST_KEYS) {
    const values = params.getAll(LIST_PARAM[key]).map(decodeValue);
    // De-dupe, keep order, drop nothing else - validity against the live options
    // is the caller's call once the data has loaded.
    if (values.length) next[key] = Array.from(new Set(values));
    else next[key] = [];
  }

  next.query = params.get(QUERY_PARAM)?.trim() || '';

  const posted = toInt(params.get(POSTED_PARAM));
  next.postedWithinDays = POSTED_WINDOWS.some((w) => Number(w.value) === posted) ? posted : 0;

  next.salaryMin = toInt(params.get(SALARY_MIN_PARAM));
  next.salaryMax = toInt(params.get(SALARY_MAX_PARAM));
  if (next.salaryMax > 0 && next.salaryMin > next.salaryMax) {
    next.salaryMin = 0;
  }

  const rating = params.get(RATING_PARAM);
  next.minRating = rating !== null && RATING_VALUES.includes(rating) ? Number(rating) : 0;

  return next;
}

/** True when the address carries at least one recognised filter parameter. */
export function hasFilterParams(params: URLSearchParams): boolean {
  if (
    params.has(QUERY_PARAM) ||
    params.has(POSTED_PARAM) ||
    params.has(SALARY_MIN_PARAM) ||
    params.has(SALARY_MAX_PARAM) ||
    params.has(RATING_PARAM)
  ) {
    return true;
  }
  return LIST_KEYS.some((key) => params.has(LIST_PARAM[key]));
}

/** Drop filter values the loaded data can't offer, over a fixed list of keys. */
function prune<K extends string>(
  filters: Record<K, string[]>,
  options: Partial<Record<K, string[]>>,
  keys: K[]
): { filters: Record<K, string[]>; changed: boolean } {
  const next = { ...filters };
  let changed = false;
  for (const key of keys) {
    if (!filters[key].length) continue;
    const allowed = new Set(options[key] ?? []);
    const kept = filters[key].filter((value) => allowed.has(value));
    if (kept.length !== filters[key].length) {
      next[key] = kept;
      changed = true;
    }
  }
  return { filters: next, changed };
}

/** Keep only filter values the loaded data can actually offer - used once the
 * options are known, so a shared link with a typo or a since-removed company
 * doesn't sit there matching nothing. */
export function pruneToOptions(
  filters: FilterState,
  options: Record<FilterListKey, string[]>
): FilterState {
  const { filters: pruned, changed } = prune(filters, options, LIST_KEYS);
  return changed ? { ...filters, ...pruned } : filters;
}

/* ------------------------------------------------------------------ *
 *  The companies page - the same idea, its own (smaller) filter set.  *
 * ------------------------------------------------------------------ */

const COMPANY_LIST_PARAM: Record<CompanyFilterKey, string> = {
  states: 'state',
  industries: 'industry',
  companyTypes: 'model',
  growthStages: 'stage',
  hqCities: 'hq',
  openRoles: 'openroles',
  sponsor: 'sponsor',
  students: 'students',
};

const COMPANY_LIST_KEYS = Object.keys(COMPANY_LIST_PARAM) as CompanyFilterKey[];

const SORT_PARAM = 'sort';
const COMPANY_SORTS: readonly CompanySort[] = ['openings', 'name'];

export function companyViewToParams(view: CompanyView): URLSearchParams {
  const params = new URLSearchParams();

  for (const key of COMPANY_LIST_KEYS) {
    for (const value of view.filters[key]) {
      params.append(COMPANY_LIST_PARAM[key], encodeValue(value));
    }
  }

  if (view.query.trim()) params.set(QUERY_PARAM, view.query.trim());
  if (view.minRating !== 0) params.set(RATING_PARAM, String(view.minRating));
  if (view.sort !== 'openings') params.set(SORT_PARAM, view.sort);

  return params;
}

export function companyViewFromParams(params: URLSearchParams, base: CompanyView): CompanyView {
  const filters = { ...NO_COMPANY_FILTERS };
  for (const key of COMPANY_LIST_KEYS) {
    const values = params.getAll(COMPANY_LIST_PARAM[key]).map(decodeValue);
    filters[key] = values.length ? Array.from(new Set(values)) : [];
  }

  const rating = params.get(RATING_PARAM);
  const sort = params.get(SORT_PARAM);

  return {
    query: params.get(QUERY_PARAM)?.trim() || '',
    filters,
    minRating: rating !== null && RATING_VALUES.includes(rating) ? Number(rating) : 0,
    sort: COMPANY_SORTS.includes(sort as CompanySort) ? (sort as CompanySort) : base.sort,
  };
}

export function hasCompanyFilterParams(params: URLSearchParams): boolean {
  if (params.has(QUERY_PARAM) || params.has(RATING_PARAM) || params.has(SORT_PARAM)) {
    return true;
  }
  return COMPANY_LIST_KEYS.some((key) => params.has(COMPANY_LIST_PARAM[key]));
}

export function pruneCompanyFilters(
  filters: CompanyFilters,
  options: Partial<Record<CompanyFilterKey, string[]>>
): CompanyFilters {
  const { filters: pruned, changed } = prune(filters, options, COMPANY_LIST_KEYS);
  return changed ? pruned : filters;
}
