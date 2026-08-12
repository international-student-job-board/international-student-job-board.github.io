import { resolveOccupation, VISA_NAMES } from '../references';
import { NOT_SPECIFIED } from '../format';
import { FilterSelect, SelectOption } from './FilterSelect';

const base = process.env.PUBLIC_URL || '';

/**
 * Every dimension holds a list, so a student can ask for (say) two pathway
 * visas and three occupations at once. Values inside one filter are OR'd;
 * separate filters are AND'd — pick "485" and "482" and you see roles matching
 * either, but a job type on top of that still has to match as well.
 */
export interface FilterState {
  query: string;
  types: string[];
  levels: string[];
  arrangements: string[];
  visas: string[];
  pathwayVisas: string[];
  anzscos: string[];
  skillAssessments: string[];
  skills: string[];
  /** A band floor, 0 for any, or -1 for "roles with no salary given". */
  salaryMin: number;
  /** Only roles starting within this many days; 0 means any start date. */
  startsWithinDays: number;
  /** Only roles posted within this many days; 0 means any age. */
  postedWithinDays: number;
  /** 'yes' | 'no' | '' (never said), any combination. */
  sponsorship: string[];
}

/** The list-valued keys, which are exactly the keys of FilterOptions. */
export type FilterListKey =
  | 'types'
  | 'levels'
  | 'arrangements'
  | 'visas'
  | 'pathwayVisas'
  | 'anzscos'
  | 'skillAssessments'
  | 'skills';

export type FilterOptions = Record<FilterListKey, string[]>;

// "261313" -> "261313 Software Engineer" for the occupation options.
const anzscoLabel = (code: string) => {
  const { name } = resolveOccupation(code, '');
  return name ? `${code} ${name}` : code;
};

// "189" -> "189 - Skilled Independent" for the two visa filters. Codes with no
// entry in VISA_NAMES fall back to the bare code.
const visaLabel = (code: string) => {
  const name = VISA_NAMES[code.trim()];
  return name ? `${code} - ${name}` : code;
};

const SALARY_BANDS = [
  { value: '40000', label: '$40k+' },
  { value: '60000', label: '$60k+' },
  { value: '80000', label: '$80k+' },
  { value: '100000', label: '$100k+' },
  // Negative is the sentinel for "no salary we could read a number from" — see
  // matches() in App.tsx. Last in the list because it narrows rather than
  // raises the floor.
  { value: '-1', label: NOT_SPECIFIED },
];

/* Windows measured forward from today, so they stay true whenever the page is
   open. Single-choice for the same reason as salary: asking for "within a
   month" and "within six" at once only ever means six. A role that has already
   started counts as starting within any window — it is available now. */
/* Looking back, where the start filter looks forward. Fine-grained at the near
   end because "since I last looked" is usually a day or two, and nobody needs
   to tell 45 days from 50. */
const POSTED_WINDOWS = [
  { value: '1', label: 'Last 24 hours' },
  { value: '2', label: 'Last 2 days' },
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last month' },
  { value: '60', label: 'Last 2 months' },
];

const START_WINDOWS = [
  { value: '30', label: 'Within a month' },
  { value: '90', label: 'Within 3 months' },
  { value: '180', label: 'Within 6 months' },
  { value: '-1', label: NOT_SPECIFIED },
];

/* The one filter this audience comes for, so it keeps the accent on its
   trigger — but it is a filter like the others now, with the same three
   answers the data actually holds. */
const SPONSORSHIP = [
  { value: 'yes', label: 'Available' },
  { value: 'no', label: 'Not offered' },
  { value: '', label: NOT_SPECIFIED },
];

const FIELDS: { key: FilterListKey; label: string; format?: (value: string) => string }[] = [
  { key: 'types', label: 'Job type' },
  { key: 'levels', label: 'Level' },
  { key: 'arrangements', label: 'Arrangement' },
  { key: 'visas', label: 'Apply on visa', format: visaLabel },
  { key: 'pathwayVisas', label: 'Leads to visa', format: visaLabel },
  { key: 'anzscos', label: 'Occupation', format: anzscoLabel },
  { key: 'skillAssessments', label: 'Skills assessment' },
  { key: 'skills', label: 'Skills' },
];

/**
 * How many filters are narrowing the list right now. The collapsed filter bar
 * shows this, so hiding the controls never hides the fact that they are on.
 */
export function countActiveFilters(filters: FilterState): number {
  return (
    FIELDS.reduce((total, field) => total + filters[field.key].length, 0) +
    (filters.salaryMin !== 0 ? 1 : 0) +
    (filters.startsWithinDays !== 0 ? 1 : 0) +
    (filters.postedWithinDays > 0 ? 1 : 0) +
    filters.sponsorship.length +
    (filters.query.trim() ? 1 : 0)
  );
}

interface Props {
  filters: FilterState;
  options: FilterOptions;
  /** How many roles each option would leave, keyed by filter then by value. */
  counts?: Partial<
    Record<
      FilterListKey | 'sponsorship' | 'salaryMin' | 'postedWithinDays' | 'startsWithinDays',
      Map<string, number>
    >
  >;
  onChange: (next: FilterState) => void;
  onClear: () => void;
}

/** One removable summary of something the reader has narrowed by. */
interface ActiveChip {
  id: string;
  field: string;
  value: string;
  remove: () => void;
}

export function Filters({ filters, options, counts, onChange, onClear }: Props) {
  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });

  // A blank value is the "not specified" marker; it needs a label or it renders
  // as an unlabelled tick box.
  const toOptions = (
    key: FilterListKey,
    values: string[],
    format?: (v: string) => string
  ): SelectOption[] =>
    values.map((value) => ({
      value,
      label: value ? (format ? format(value) : value) : NOT_SPECIFIED,
      count: counts?.[key]?.get(value) ?? 0,
    }));

  // Rather than a bare count, each selection gets its own chip below the row,
  // so what is currently narrowing the list is readable at a glance and can be
  // undone one at a time.
  const chips: ActiveChip[] = [];

  FIELDS.forEach((field) => {
    filters[field.key].forEach((value) => {
      chips.push({
        id: `${field.key}:${value}`,
        field: field.label,
        value: value ? (field.format ? field.format(value) : value) : NOT_SPECIFIED,
        remove: () =>
          set({ [field.key]: filters[field.key].filter((v) => v !== value) } as Partial<FilterState>),
      });
    });
  });

  if (filters.salaryMin !== 0) {
    chips.push({
      id: 'salary',
      field: 'Salary',
      value: SALARY_BANDS.find((b) => b.value === String(filters.salaryMin))?.label ?? '',
      remove: () => set({ salaryMin: 0 }),
    });
  }

  if (filters.postedWithinDays > 0) {
    chips.push({
      id: 'posted',
      field: 'Posted',
      value:
        POSTED_WINDOWS.find((w) => w.value === String(filters.postedWithinDays))?.label ?? '',
      remove: () => set({ postedWithinDays: 0 }),
    });
  }

  if (filters.startsWithinDays !== 0) {
    chips.push({
      id: 'starts',
      field: 'Starts',
      value:
        START_WINDOWS.find((w) => w.value === String(filters.startsWithinDays))?.label ?? '',
      remove: () => set({ startsWithinDays: 0 }),
    });
  }

  filters.sponsorship.forEach((value) => {
    chips.push({
      id: `sponsorship:${value}`,
      field: 'Sponsorship',
      value: SPONSORSHIP.find((o) => o.value === value)?.label ?? NOT_SPECIFIED,
      remove: () =>
        set({ sponsorship: filters.sponsorship.filter((v) => v !== value) }),
    });
  });

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
            placeholder="Search company, title or skill"
            value={filters.query}
            onChange={(e) => set({ query: e.target.value })}
          />
        </div>

        {FIELDS.map((field) => (
          <FilterSelect
            key={field.key}
            label={field.label}
            options={toOptions(field.key, options[field.key], field.format)}
            selected={filters[field.key]}
            onChange={(next) => set({ [field.key]: next } as Partial<FilterState>)}
          />
        ))}

        <FilterSelect
          label="Salary"
          multiple={false}
          options={SALARY_BANDS.map((b) => ({
            ...b,
            count: counts?.salaryMin?.get(b.value) ?? 0,
          }))}
          selected={filters.salaryMin !== 0 ? [String(filters.salaryMin)] : []}
          onChange={(next) => set({ salaryMin: Number(next[0] ?? 0) })}
        />

        <FilterSelect
          label="Posted"
          multiple={false}
          options={POSTED_WINDOWS.map((w) => ({
            ...w,
            count: counts?.postedWithinDays?.get(w.value) ?? 0,
          }))}
          selected={filters.postedWithinDays > 0 ? [String(filters.postedWithinDays)] : []}
          onChange={(next) => set({ postedWithinDays: Number(next[0] ?? 0) })}
        />

        <FilterSelect
          label="Starts"
          multiple={false}
          options={START_WINDOWS.map((w) => ({
            ...w,
            count: counts?.startsWithinDays?.get(w.value) ?? 0,
          }))}
          selected={filters.startsWithinDays !== 0 ? [String(filters.startsWithinDays)] : []}
          onChange={(next) => set({ startsWithinDays: Number(next[0] ?? 0) })}
        />

        <div className={`fselect-sponsor${filters.sponsorship.length ? ' is-set' : ''}`}>
          <FilterSelect
            label="Sponsorship"
            options={SPONSORSHIP.map((o) => ({
              ...o,
              count: counts?.sponsorship?.get(o.value) ?? 0,
            }))}
            selected={filters.sponsorship}
            onChange={(next) => set({ sponsorship: next })}
          />
        </div>
      </div>

      {chips.length > 0 && (
        <div className="active-filters">
          <h2 className="visually-hidden">Active filters</h2>
          <ul className="active-chips">
            {chips.map((chip) => (
              <li key={chip.id}>
                <button
                  type="button"
                  className="active-chip"
                  onClick={chip.remove}
                  title={`${chip.field}: ${chip.value}`}
                >
                  <span className="active-chip-field">{chip.field}</span>
                  <span className="active-chip-value">{chip.value}</span>
                  <span className="active-chip-x" aria-hidden="true" />
                  <span className="visually-hidden">Remove filter</span>
                </button>
              </li>
            ))}
          </ul>

          <button type="button" className="filter-clear" onClick={onClear}>
            Clear all
            <span className="filter-clear-count">{chips.length}</span>
          </button>
        </div>
      )}
    </div>
  );
}
