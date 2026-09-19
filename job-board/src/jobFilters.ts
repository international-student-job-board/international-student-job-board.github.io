import { Job, hasSalary, salaryRangeAud, jobLocation } from './types';
import { isRecent } from './jobs';
import { dateValue, todayISO, daysBeforeISO } from './format';
import { getConstant } from './constants';
import {
  pathwayVisasFor,
  occupationCodesFor,
  occupationListsFor,
  oscaCodesFor,
  unitGroupCodesFor,
  invitedOccupationCodesFor,
} from './references';
import { FilterState, FilterOptions, FilterListKey } from './components/Filters';
import { RATING_UNSPECIFIED, RATING_VALUES } from './components/RatingFilter';

/** The value a filter uses to mean "roles that don't say". */
export const UNSPECIFIED = '';

export const EMPTY_FILTERS: FilterState = {
  query: '',
  companies: [],
  jobLocations: [],
  types: [],
  employmentTypes: [],
  jobLevels: [],
  workArrangements: [],
  educationLevels: [],
  industries: [],
  companyTypes: [],
  growthStages: [],
  hqLocations: [],
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

/**
 * The recency filter, resolved to an instant for one filtering pass.
 *
 * A role's posting date is a calendar date with no time of day, read as midnight UTC. So the
 * window is counted in calendar days - "posted no earlier than N days before today" - and not
 * as `now - N * 24h`. The rolling version broke on exactly the roles it was for: a role dated
 * yesterday is midnight yesterday, which is already more than 24 hours ago by mid-morning, so
 * "Last 24 hours" was empty however fresh the data was. With no time to go on, "last 24 hours"
 * can only mean today and yesterday, and that is what it returns.
 */
export const cutoff = (filters: FilterState): number =>
  filters.postedWithinDays > 0 ? dateValue(daysBeforeISO(todayISO(), filters.postedWithinDays)) : 0;

/** An empty filter narrows nothing; otherwise the job's value has to be in it. */
const allows = (selected: string[], value: string) =>
  selected.length === 0 || selected.includes(value.trim());

/** Same, for the fields where the job itself holds a list (occupations, visas). */
const overlaps = (selected: string[], values: string[]) =>
  selected.length === 0 ||
  (values.length
    ? values.some((value) => selected.includes(value))
    : selected.includes(UNSPECIFIED));

/** A hand-checked yes/no/nobody-said column as a filter value. */
const answer = (value: boolean | undefined): string[] => [
  value === true ? 'yes' : value === false ? 'no' : UNSPECIFIED,
];

const uniqueSorted = (values: string[]) => Array.from(new Set(values)).sort();

/**
 * Orders values by rank in a hierarchy (e.g. "Internship" before "Senior"), rather than
 * alphabetically - for job level and education, where A-to-Z would scatter the natural
 * progression a reader expects to scan top to bottom. A value the hierarchy doesn't name
 * (a typo, or one not yet added to content/constants.json) sorts after every known rung
 * rather than disappearing, and ties among unknown values keep their relative order.
 */
const byHierarchy = (order: string[]) => {
  const rank = new Map(order.map((value, i) => [value, i]));
  return (a: string, b: string) => (rank.get(a) ?? order.length) - (rank.get(b) ?? order.length);
};

/** Stale roles are dropped here rather than inside the filtering, so they are gone from
 * everything downstream: the count, the default selection, and the filter dropdowns - which
 * would otherwise offer a company or an occupation that no listed role has. */
export function filterOpenJobs(jobs: Job[]): Job[] {
  const today = todayISO();
  return jobs.filter((job) => isRecent(job, today));
}

/**
 * `postedAfter` is a timestamp resolved once per pass rather than per job, so every card in
 * one run is measured against the same instant. 0 means the recency filter is off.
 */
export function matches(job: Job, filters: FilterState, postedAfter: number): boolean {
  if (!allows(filters.companies, job.company.name)) return false;
  if (!allows(filters.jobLocations, job.location)) return false;
  if (!allows(filters.types, job.type)) return false;
  if (!allows(filters.employmentTypes, job.employmentType)) return false;
  if (!overlaps(filters.jobLevels, job.jobLevels)) return false;
  if (!overlaps(filters.workArrangements, job.workArrangements)) return false;
  if (!overlaps(filters.educationLevels, job.educationLevels)) return false;
  if (!overlaps(filters.industries, job.company.industries)) return false;
  if (!overlaps(filters.companyTypes, job.company.types)) return false;
  if (!allows(filters.growthStages, job.company.growthStage)) return false;
  if (!allows(filters.hqLocations, job.company.location)) return false;
  // Empty unless the role was in the latest SkillSelect round, so an unselected filter
  // still narrows nothing while a selected one only ever matches invited roles.
  if (!overlaps(filters.invitedOccupations, invitedOccupationCodesFor(job))) return false;
  // A role can map to several occupations, so it matches if any of them do.
  if (!overlaps(filters.anzscos, occupationCodesFor(job))) return false;
  // The occupations' own visas are what the detail page shows as pathways, so filtering
  // reads the same function - a role can always be found by the visas it is shown to offer.
  if (!overlaps(filters.unitGroups, unitGroupCodesFor(job))) return false;
  if (!overlaps(filters.oscas, oscaCodesFor(job))) return false;
  if (!overlaps(filters.occupationLists, occupationListsFor(job))) return false;
  if (!overlaps(filters.pathwayVisas, pathwayVisasFor(job))) return false;
  if (!overlaps(filters.sponsor, answer(job.company.accreditedSponsor))) return false;
  if (!overlaps(filters.students, answer(job.company.hiresInternationalStudents))) return false;

  // Employer rating: a company we couldn't match on Glassdoor can't be shown to
  // clear the bar, so it drops out once a minimum is asked for - or it's the
  // only thing shown when the reader asks for the unrated ones.
  if (filters.minRating === RATING_UNSPECIFIED) {
    if (job.company.glassdoorRating) return false;
  } else if (filters.minRating > 0) {
    const rating = job.company.glassdoorRating;
    if (!rating || rating < filters.minRating) return false;
  }

  // A role we can't date can't be shown to be recent, so it drops out when the reader asks
  // for recent ones.
  if (postedAfter > 0) {
    const posted = dateValue(job.posted);
    if (!Number.isFinite(posted) || posted < postedAfter) return false;
  }

  // Salary: a role passes when its AUD span overlaps the asked range. A role with
  // no pay data can't be shown to overlap, so it drops out once the filter is on.
  if (filters.salaryMin > 0 || filters.salaryMax > 0) {
    const span = hasSalary(job.salary) ? salaryRangeAud(job.salary) : null;
    if (!span) return false;
    const lo = filters.salaryMin || 0;
    const hi = filters.salaryMax || Number.POSITIVE_INFINITY;
    if (span[1] < lo || span[0] > hi) return false;
  }

  const q = filters.query.trim().toLowerCase();
  if (!q) return true;
  // Every word has to be somewhere in the role, in any order: "graduate marketing sydney" finds a
  // Marketing role at graduate level in Sydney. The whole phrase used to have to appear as one
  // unbroken run of text, so any search of more than one field's worth of words found nothing.
  const text = searchText(job);
  return q.split(/\s+/).every((word) => text.includes(word));
}

/** What a search reads, built once per role: it is asked once per role per filter pass, and a pass
 * runs on every keystroke. */
const searchIndex = new WeakMap<Job, string>();

function searchText(job: Job): string {
  let text = searchIndex.get(job);
  if (text === undefined) {
    text = [
      job.title,
      job.company.name,
      jobLocation(job),
      job.location,
      job.type,
      job.employmentType,
      ...job.jobLevels,
      ...job.workArrangements,
      ...job.occupationNames,
      ...job.company.industries,
      ...job.company.types,
    ]
      .join(' ')
      .toLowerCase();
    searchIndex.set(job, text);
  }
  return text;
}

/** One picker per facet: the values a job carries for that filter. Shared between the
 * per-option counts and the dropdown contents, so the two can never drift apart. */
const FACET_PICKERS: Record<FilterListKey, (job: Job) => string[]> = {
  companies: (j) => [j.company.name],
  jobLocations: (j) => [j.location],
  types: (j) => [j.type],
  employmentTypes: (j) => [j.employmentType],
  jobLevels: (j) => j.jobLevels,
  workArrangements: (j) => j.workArrangements,
  educationLevels: (j) => j.educationLevels,
  industries: (j) => j.company.industries,
  companyTypes: (j) => j.company.types,
  growthStages: (j) => [j.company.growthStage],
  hqLocations: (j) => [j.company.location],
  anzscos: occupationCodesFor,
  invitedOccupations: invitedOccupationCodesFor,
  unitGroups: unitGroupCodesFor,
  oscas: oscaCodesFor,
  occupationLists: occupationListsFor,
  pathwayVisas: pathwayVisasFor,
  sponsor: (j) => answer(j.company.accreditedSponsor),
  students: (j) => answer(j.company.hiresInternationalStudents),
};

export type FacetCounts = Record<FilterListKey, Map<string, number>> & {
  postedWithinDays: Map<string, number>;
  minRating: Map<string, number>;
};

/**
 * How many roles each option would leave, counted against everything the *other* filters
 * allow - not against the whole board and not against the current results.
 */
export function computeFacetCounts(openJobs: Job[], filters: FilterState): FacetCounts {
  const postedAfter = cutoff(filters);
  const without = (key: FilterListKey) =>
    openJobs.filter((job) => matches(job, { ...filters, [key]: [] }, postedAfter));

  const tally = (list: Job[], pick: (job: Job) => string[]) => {
    const counted = new Map<string, number>();
    list.forEach((job) => {
      const values = pick(job).filter(Boolean);
      const keys = values.length ? Array.from(new Set(values)) : [UNSPECIFIED];
      keys.forEach((key) => counted.set(key, (counted.get(key) ?? 0) + 1));
    });
    return counted;
  };

  const byFilter = Object.fromEntries(
    (Object.keys(FACET_PICKERS) as FilterListKey[]).map((key) => [
      key,
      tally(without(key), FACET_PICKERS[key]),
    ])
  ) as Record<FilterListKey, Map<string, number>>;

  // The recency filter can't be tallied by walking a job's values, because its options are
  // thresholds rather than things a job "has".
  const postedCounts = new Map<string, number>();
  ['1', '2', '7', '14', '30', '60'].forEach((value) => {
    const asked = { ...filters, postedWithinDays: Number(value) };
    postedCounts.set(value, openJobs.filter((job) => matches(job, asked, cutoff(asked))).length);
  });

  // Same story for the rating rungs: thresholds, not values a role carries.
  const ratingCounts = new Map<string, number>();
  RATING_VALUES.forEach((value) => {
    const asked = { ...filters, minRating: Number(value) };
    ratingCounts.set(value, openJobs.filter((job) => matches(job, asked, postedAfter)).length);
  });

  return { ...byFilter, postedWithinDays: postedCounts, minRating: ratingCounts };
}

/** Every distinct value a facet offers across the open roles, plus what each filter needs
 * beyond a plain "distinct values" pass. */
export function computeFilterOptions(openJobs: Job[]): FilterOptions {
  // Every distinct value, plus the "not specified" marker when at least one role is missing
  // that field - offered only where it would actually match something, so the dropdowns
  // don't grow an option that finds nothing.
  const from = (pick: (job: Job) => string[], compare?: (a: string, b: string) => number) => {
    const values = Array.from(new Set(openJobs.flatMap(pick).filter(Boolean))).sort(compare);
    const anyBlank = openJobs.some((job) => pick(job).filter(Boolean).length === 0);
    return anyBlank ? [...values, UNSPECIFIED] : values;
  };

  return {
    companies: from(FACET_PICKERS.companies),
    jobLocations: from(FACET_PICKERS.jobLocations),
    types: from(FACET_PICKERS.types),
    employmentTypes: from(FACET_PICKERS.employmentTypes),
    jobLevels: from(FACET_PICKERS.jobLevels, byHierarchy(getConstant('jobLevel'))),
    workArrangements: from(FACET_PICKERS.workArrangements),
    educationLevels: from(
      FACET_PICKERS.educationLevels,
      byHierarchy(getConstant('educationLevel'))
    ),
    industries: from(FACET_PICKERS.industries),
    companyTypes: from(FACET_PICKERS.companyTypes),
    growthStages: from(FACET_PICKERS.growthStages),
    hqLocations: from(FACET_PICKERS.hqLocations),
    invitedOccupations: uniqueSorted(openJobs.flatMap(invitedOccupationCodesFor)),
    anzscos: from(occupationCodesFor),
    unitGroups: from(unitGroupCodesFor),
    oscas: from(oscaCodesFor),
    occupationLists: from(occupationListsFor),
    pathwayVisas: from(pathwayVisasFor),
    // These two carry a value for every role - 'yes', 'no' or the blank sentinel - so they
    // never need the "any blank?" pass the others do.
    sponsor: uniqueSorted(openJobs.flatMap(FACET_PICKERS.sponsor)),
    students: uniqueSorted(openJobs.flatMap(FACET_PICKERS.students)),
  };
}
