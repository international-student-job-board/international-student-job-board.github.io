import { useState } from 'react';
import {
  occupationName,
  occupationListLabel,
  oscaName,
  unitGroupTitle,
  invitedScoreFor,
  ANZSCO_NOTE,
  INVITED_ROUND_NOTE,
  MANUAL_REVIEW_NOTE,
  OCCUPATION_LIST_NOTE,
  OSCA_NOTE,
  UNIT_GROUP_NOTE,
  VISA_NAMES,
} from '../references';
import { NOT_SPECIFIED, formatMoney } from '../format';
import { prettyLabel } from '../labels';
import { useIsMobile } from '../useMediaQuery';
import { ActiveFilters, ActiveChip } from './ActiveFilters';
import { FilterSelect, SelectOption } from './FilterSelect';
import { RangeFilter } from './RangeFilter';
import { RatingFilter, ratingChipLabel } from './RatingFilter';
import { FiltersModal, FilterSection } from './FiltersModal';

const base = process.env.PUBLIC_URL || '';

/** Every list dimension holds an array, so a student can ask for several at once. */
export interface FilterState {
  query: string;
  companies: string[];
  states: string[];
  types: string[];
  /** Full-time / Part-time / … - a different question from `types`, which is the
   * Dealroom role category ("Backend development"). */
  employmentTypes: string[];
  jobLevels: string[];
  workArrangements: string[];
  educationLevels: string[];
  cities: string[];
  industries: string[];
  /** The company's own tags - what it makes and how it makes money. */
  companyTypes: string[];
  growthStages: string[];
  hqCities: string[];
  anzscos: string[];
  invitedOccupations: string[];
  unitGroups: string[];
  oscas: string[];
  occupationLists: string[];
  pathwayVisas: string[];
  /** Each 'yes' | 'no' | '' (not checked yet), any combination. */
  sponsor: string[];
  students: string[];
  /** Only roles posted within this many days; 0 means any age. */
  postedWithinDays: number;
  /** AUD bounds on pay; 0 at either end means unbounded there. */
  salaryMin: number;
  salaryMax: number;
  /** Minimum Glassdoor employer rating out of 5; 0 means any. */
  minRating: number;
}

/** The list-valued keys, which are exactly the keys of FilterOptions. */
export type FilterListKey =
  | 'companies'
  | 'states'
  | 'types'
  | 'employmentTypes'
  | 'jobLevels'
  | 'workArrangements'
  | 'educationLevels'
  | 'cities'
  | 'industries'
  | 'companyTypes'
  | 'growthStages'
  | 'hqCities'
  | 'anzscos'
  | 'invitedOccupations'
  | 'unitGroups'
  | 'oscas'
  | 'occupationLists'
  | 'pathwayVisas'
  | 'sponsor'
  | 'students';

export type FilterOptions = Record<FilterListKey, string[]>;

/** "261313" -> "261313 - Software Engineer"; the bare code if we can't name it. */
const codeLabel = (code: string, name: string) => (name ? `${code} - ${name}` : code);
const anzscoLabel = (code: string) => codeLabel(code, occupationName(code));

const invitedOccupationLabel = (code: string) => {
  const score = invitedScoreFor(code);
  const label = anzscoLabel(code);
  return score === undefined ? label : `${label} - Min score is ${score}`;
};

const unitGroupLabel = (code: string) => codeLabel(code, unitGroupTitle(code));
const oscaLabel = (code: string) => codeLabel(code, oscaName(code));

// "189" -> "189 - Skilled Independent".
const visaLabel = (code: string) => {
  const name = VISA_NAMES[code.trim()];
  return name ? `${code} - ${name}` : code;
};

export const POSTED_WINDOWS = [
  { value: '1', label: 'Last 24 hours' },
  { value: '2', label: 'Last 2 days' },
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last month' },
  { value: '60', label: 'Last 2 months' },
];

/** The rungs the salary range offers, in AUD. */
export const SALARY_STEPS = [40_000, 60_000, 80_000, 100_000, 120_000, 150_000, 200_000, 250_000];

export const SALARY_NOTE =
  'If the salary is not provided in the job advert, an estimate is provided ' +
  'from Levels.fyi or Glassdoor. Some jobs could have neither, unfortunately.';

/** The three answers the two hand-checked columns can hold. */
export const answerLabel = (value: string) =>
  value === 'yes' ? 'Yes' : value === 'no' ? 'No' : 'Not checked yet';

interface FieldMeta {
  key: FilterListKey;
  label: string;
  format?: (value: string) => string;
  tooltip?: string;
  accent?: boolean;
}

const FIELDS: FieldMeta[] = [
  { key: 'companies', label: 'Company' },
  { key: 'states', label: 'State' },
  { key: 'types', label: 'Job type', format: prettyLabel },
  { key: 'employmentTypes', label: 'Employment type' },
  { key: 'jobLevels', label: 'Job level' },
  { key: 'workArrangements', label: 'Work arrangement' },
  { key: 'educationLevels', label: 'Education' },
  { key: 'cities', label: 'Location', format: prettyLabel },
  { key: 'industries', label: 'Industry', format: prettyLabel },
  { key: 'companyTypes', label: 'Model & tech', format: prettyLabel },
  { key: 'growthStages', label: 'Stage', format: prettyLabel },
  { key: 'hqCities', label: 'Head office', format: prettyLabel },
  { key: 'anzscos', label: 'ANZSCO occupations', format: anzscoLabel, tooltip: ANZSCO_NOTE },
  {
    key: 'invitedOccupations',
    label: 'In the latest invitation round',
    format: invitedOccupationLabel,
    tooltip: INVITED_ROUND_NOTE,
    accent: true,
  },
  {
    key: 'unitGroups',
    label: 'ANZSCO unit group',
    format: unitGroupLabel,
    tooltip: UNIT_GROUP_NOTE,
  },
  { key: 'oscas', label: 'OSCA occupations', format: oscaLabel, tooltip: OSCA_NOTE },
  {
    key: 'occupationLists',
    label: 'Occupation list',
    format: occupationListLabel,
    tooltip: OCCUPATION_LIST_NOTE,
  },
  { key: 'pathwayVisas', label: 'Leads to visa', format: visaLabel },
  {
    key: 'sponsor',
    label: 'Accredited sponsor',
    format: answerLabel,
    tooltip: MANUAL_REVIEW_NOTE,
    accent: true,
  },
  {
    key: 'students',
    label: 'Hires international students and graduates',
    format: answerLabel,
    tooltip: MANUAL_REVIEW_NOTE,
    accent: true,
  },
];

const FIELD_BY_KEY = new Map(FIELDS.map((f) => [f.key, f]));

/** Filters that stay on the bar; the rest live in the modal. */
const QUICK_KEYS: FilterListKey[] = [
  'anzscos',
  'invitedOccupations',
  'pathwayVisas',
  'sponsor',
  'students',
];

/** The modal's filters, in sections - the same headings the companies page uses. */
const MODAL_GROUPS: { title: string; keys: (FilterListKey | 'rating')[] }[] = [
  { title: 'Where', keys: ['states', 'cities', 'hqCities'] },
  {
    title: 'The role',
    keys: ['types', 'employmentTypes', 'jobLevels', 'workArrangements', 'educationLevels'],
  },
  {
    title: 'The employer',
    keys: ['companies', 'industries', 'companyTypes', 'growthStages', 'rating'],
  },
  { title: 'Occupation and visa', keys: ['unitGroups', 'oscas', 'occupationLists'] },
];

const listCount = (filters: FilterState) =>
  FIELDS.reduce((total, field) => total + filters[field.key].length, 0);

/** How many filters are narrowing the list right now. */
export function countActiveFilters(filters: FilterState): number {
  return (
    listCount(filters) +
    (filters.postedWithinDays > 0 ? 1 : 0) +
    (filters.salaryMin > 0 || filters.salaryMax > 0 ? 1 : 0) +
    (filters.minRating !== 0 ? 1 : 0) +
    (filters.query.trim() ? 1 : 0)
  );
}

/** How many of the modal's filters are set - the count on the "More filters" button. */
function countModalFilters(filters: FilterState): number {
  const onBar = [...QUICK_KEYS].reduce((total, key) => total + filters[key].length, 0);
  return listCount(filters) - onBar + (filters.minRating !== 0 ? 1 : 0);
}

interface Props {
  filters: FilterState;
  options: FilterOptions;
  /** How many roles each option would leave, keyed by filter then by value. */
  counts?: Partial<Record<FilterListKey | 'postedWithinDays' | 'minRating', Map<string, number>>>;
  resultCount: number;
  onChange: (next: FilterState) => void;
  onClear: () => void;
}

/** A blank value is the "not specified" marker; it needs a readable label. */
const optionLabel = (value: string, format?: (v: string) => string) =>
  (format ? format(value) : value) || NOT_SPECIFIED;

export function Filters({ filters, options, counts, resultCount, onChange, onClear }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const isMobile = useIsMobile();
  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });

  const toOptions = (key: FilterListKey, format?: (v: string) => string): SelectOption[] =>
    options[key].map((value) => ({
      value,
      label: optionLabel(value, format),
      count: counts?.[key]?.get(value) ?? 0,
    }));

  // A plain multi-select for one field, on the bar or in the modal.
  const select = (key: FilterListKey, overlay: boolean) => {
    const field = FIELD_BY_KEY.get(key);
    if (!field) return null;
    const el = (
      <FilterSelect
        label={field.label}
        tooltip={field.tooltip}
        searchable={!isMobile}
        overlay={overlay}
        options={toOptions(key, field.format)}
        selected={filters[key]}
        onChange={(next) => set({ [key]: next } as Partial<FilterState>)}
      />
    );
    return field.accent ? (
      <div className={`fselect-sponsor${filters[key].length ? ' is-set' : ''}`}>{el}</div>
    ) : (
      el
    );
  };

  // Every applied filter gets its own chip below the bar.
  const chips: ActiveChip[] = [];
  FIELDS.forEach((field) => {
    filters[field.key].forEach((value) => {
      chips.push({
        id: `${field.key}:${value}`,
        field: field.label,
        value: optionLabel(value, field.format),
        remove: () =>
          set({
            [field.key]: filters[field.key].filter((v) => v !== value),
          } as Partial<FilterState>),
      });
    });
  });
  if (filters.postedWithinDays > 0) {
    chips.push({
      id: 'posted',
      field: 'Posted',
      value: POSTED_WINDOWS.find((w) => w.value === String(filters.postedWithinDays))?.label ?? '',
      remove: () => set({ postedWithinDays: 0 }),
    });
  }
  if (filters.salaryMin > 0 || filters.salaryMax > 0) {
    chips.push({
      id: 'salary',
      field: 'Salary',
      value: `${filters.salaryMin > 0 ? formatMoney(filters.salaryMin) : 'Any'} - ${
        filters.salaryMax > 0 ? formatMoney(filters.salaryMax) : 'Any'
      }`,
      remove: () => set({ salaryMin: 0, salaryMax: 0 }),
    });
  }
  if (filters.minRating !== 0) {
    chips.push({
      id: 'rating',
      field: 'Employer rating',
      value: ratingChipLabel(filters.minRating),
      remove: () => set({ minRating: 0 }),
    });
  }

  const modalCount = countModalFilters(filters);

  return (
    <div className="filterbar" role="search">
      <div className="filter-row">
        <div className="filter-search">
          <label className="visually-hidden" htmlFor="job-search">
            Search jobs
          </label>
          <img
            className="search-icon"
            src={`${base}/icons/magifying-glass.svg`}
            alt=""
            aria-hidden="true"
            width={18}
            height={18}
          />
          <input
            id="job-search"
            type="search"
            placeholder="Search company, title or occupation"
            value={filters.query}
            onChange={(e) => set({ query: e.target.value })}
          />
        </div>

        <FilterSelect
          label="Posted"
          multiple={false}
          searchable={false}
          options={POSTED_WINDOWS.map((w) => ({
            ...w,
            count: counts?.postedWithinDays?.get(w.value) ?? 0,
          }))}
          selected={filters.postedWithinDays > 0 ? [String(filters.postedWithinDays)] : []}
          onChange={(next) => set({ postedWithinDays: Number(next[0] ?? 0) })}
        />

        {select('students', false)}
        {select('sponsor', false)}
        {select('invitedOccupations', false)}
        {select('anzscos', false)}
        {select('pathwayVisas', false)}

        <RangeFilter
          label="Salary"
          value={{ min: filters.salaryMin, max: filters.salaryMax }}
          onChange={(next) => set({ salaryMin: next.min, salaryMax: next.max })}
          steps={SALARY_STEPS}
          format={(aud) => formatMoney(aud)}
          tooltip={SALARY_NOTE}
        />

        <button
          type="button"
          className={`more-filters${modalCount ? ' is-set' : ''}`}
          onClick={() => setModalOpen(true)}
        >
          More filters
          {modalCount > 0 && <span className="more-filters-count">{modalCount}</span>}
        </button>
      </div>

      <ActiveFilters chips={chips} onClear={onClear} />

      <FiltersModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onClear={onClear}
        resultCount={resultCount}
        resultNoun="role"
      >
        {MODAL_GROUPS.map((group) => (
          <FilterSection title={group.title} key={group.title}>
            {group.keys.map((key) => (
              <div className="fmodal-control" key={key}>
                {key === 'rating' ? (
                  <RatingFilter
                    value={filters.minRating}
                    onChange={(next) => set({ minRating: next })}
                    counts={counts?.minRating}
                    overlay
                  />
                ) : (
                  select(key, true)
                )}
              </div>
            ))}
          </FilterSection>
        ))}
      </FiltersModal>
    </div>
  );
}
