import { resolveOccupation, VISA_NAMES } from '../references';
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
  salaryMin: number;
  /** Only roles posted within this many days; 0 means any age. */
  postedWithinDays: number;
  sponsoredOnly: boolean;
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
];

/* Windows measured back from today, so they stay true whenever the page is
   open. Single-choice for the same reason as salary: asking for the past week
   and the past month at once only ever means the past month. */
const POSTED_WINDOWS = [
  { value: '7', label: 'Past week' },
  { value: '14', label: 'Past 2 weeks' },
  { value: '30', label: 'Past month' },
  { value: '60', label: 'Past 2 months' },
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
    (filters.salaryMin > 0 ? 1 : 0) +
    (filters.postedWithinDays > 0 ? 1 : 0) +
    (filters.sponsoredOnly ? 1 : 0) +
    (filters.query.trim() ? 1 : 0)
  );
}

interface Props {
  filters: FilterState;
  options: FilterOptions;
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

export function Filters({ filters, options, onChange, onClear }: Props) {
  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });

  const toOptions = (values: string[], format?: (v: string) => string): SelectOption[] =>
    values.map((value) => ({ value, label: format ? format(value) : value }));

  // Rather than a bare count, each selection gets its own chip below the row,
  // so what is currently narrowing the list is readable at a glance and can be
  // undone one at a time.
  const chips: ActiveChip[] = [];

  FIELDS.forEach((field) => {
    filters[field.key].forEach((value) => {
      chips.push({
        id: `${field.key}:${value}`,
        field: field.label,
        value: field.format ? field.format(value) : value,
        remove: () =>
          set({ [field.key]: filters[field.key].filter((v) => v !== value) } as Partial<FilterState>),
      });
    });
  });

  if (filters.salaryMin > 0) {
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

  if (filters.sponsoredOnly) {
    chips.push({
      id: 'sponsored',
      field: 'Visa',
      value: 'Sponsorship available',
      remove: () => set({ sponsoredOnly: false }),
    });
  }

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
            options={toOptions(options[field.key], field.format)}
            selected={filters[field.key]}
            onChange={(next) => set({ [field.key]: next } as Partial<FilterState>)}
          />
        ))}

        <FilterSelect
          label="Salary"
          multiple={false}
          options={SALARY_BANDS}
          selected={filters.salaryMin > 0 ? [String(filters.salaryMin)] : []}
          onChange={(next) => set({ salaryMin: Number(next[0] ?? 0) })}
        />

        <FilterSelect
          label="Posted"
          multiple={false}
          options={POSTED_WINDOWS}
          selected={filters.postedWithinDays > 0 ? [String(filters.postedWithinDays)] : []}
          onChange={(next) => set({ postedWithinDays: Number(next[0] ?? 0) })}
        />

        {/* Two labels, one per breakpoint: the full phrase doesn't fit a
            half-width chip on a phone. The aria-label keeps the long wording
            in the accessibility tree at every size, so what a screen reader
            announces never depends on the viewport. */}
        <label className="chip-toggle chip-sponsor">
          <input
            type="checkbox"
            aria-label="Visa sponsorship available"
            checked={filters.sponsoredOnly}
            onChange={(e) => set({ sponsoredOnly: e.target.checked })}
          />
          <span className="chip-label-long">Visa sponsorship available</span>
          <span className="chip-label-short">Sponsorship</span>
        </label>
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
