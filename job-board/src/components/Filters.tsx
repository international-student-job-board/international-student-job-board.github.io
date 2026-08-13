import { occupationName, VISA_NAMES } from '../references';
import { NOT_SPECIFIED } from '../format';
import { prettyLabel } from '../labels';
import { ActiveFilters, ActiveChip } from './ActiveFilters';
import { FilterSelect, SelectOption } from './FilterSelect';

const base = process.env.PUBLIC_URL || '';

/**
 * Every dimension holds a list, so a student can ask for (say) two pathway
 * visas and three occupations at once. Values inside one filter are OR'd;
 * separate filters are AND'd — pick "485" and "482" and you see roles matching
 * either, but a job type on top of that still has to match as well.
 *
 * There is one filter per thing the board actually knows. The set shrank with
 * the data: level, work arrangement, education and salary went when the source
 * stopped carrying them, and a filter over a column that is blank on every role
 * is worse than no filter — it looks like a way to narrow the list and returns
 * nothing.
 */
export interface FilterState {
  query: string;
  companies: string[];
  types: string[];
  cities: string[];
  industries: string[];
  /** The company's own tags — what it makes and how it makes money. */
  companyTypes: string[];
  growthStages: string[];
  hqCities: string[];
  anzscos: string[];
  pathwayVisas: string[];
  /** Each 'yes' | 'no' | '' (not checked yet), any combination. */
  sponsor: string[];
  students: string[];
  /** Only roles posted within this many days; 0 means any age. */
  postedWithinDays: number;
}

/** The list-valued keys, which are exactly the keys of FilterOptions. */
export type FilterListKey =
  | 'companies'
  | 'types'
  | 'cities'
  | 'industries'
  | 'companyTypes'
  | 'growthStages'
  | 'hqCities'
  | 'anzscos'
  | 'pathwayVisas'
  | 'sponsor'
  | 'students';

export type FilterOptions = Record<FilterListKey, string[]>;

// "261313" -> "261313 Software Engineer" for the occupation options.
const anzscoLabel = (code: string) => {
  const name = occupationName(code);
  return name ? `${code} ${name}` : code;
};

// "189" -> "189 - Skilled Independent". Codes with no entry in VISA_NAMES fall
// back to the bare code.
const visaLabel = (code: string) => {
  const name = VISA_NAMES[code.trim()];
  return name ? `${code} - ${name}` : code;
};

/* Looking back from today, so the windows stay true whenever the page is open.
   Single-choice: asking for "within a week" and "within a month" at once only
   ever means a month. Fine-grained at the near end because "since I last
   looked" is usually a day or two, and nobody needs to tell 45 days from 50. */
const POSTED_WINDOWS = [
  { value: '1', label: 'Last 24 hours' },
  { value: '2', label: 'Last 2 days' },
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last month' },
  { value: '60', label: 'Last 2 months' },
];

/**
 * The three answers the two hand-checked columns can hold. Blank means nobody
 * has checked, which is not "no" — so it is labelled rather than left as an
 * unnamed tick box.
 */
const answerLabel = (value: string) =>
  value === 'yes' ? 'Yes' : value === 'no' ? 'No' : 'Not checked yet';

const FIELDS: {
  key: FilterListKey;
  label: string;
  format?: (value: string) => string;
  /** Given the accent, because it is what this audience came for. */
  accent?: boolean;
}[] = [
  { key: 'companies', label: 'Company' },
  { key: 'types', label: 'Job type', format: prettyLabel },
  { key: 'cities', label: 'Location', format: prettyLabel },
  { key: 'industries', label: 'Industry', format: prettyLabel },
  // Named the same as the fact on the job detail page. One thing, one name —
  // "Job type" is what the role does, this is what the company is.
  { key: 'companyTypes', label: 'Model & tech', format: prettyLabel },
  // The growth stage on its own, not the "startup · early stage" pair the
  // detail page shows. Combined, "late stage" and "startup · late stage" are
  // separate options and finding late-stage companies takes three ticks.
  { key: 'growthStages', label: 'Stage', format: prettyLabel },
  { key: 'hqCities', label: 'Head office', format: prettyLabel },
  { key: 'anzscos', label: 'Occupation', format: anzscoLabel },
  { key: 'pathwayVisas', label: 'Leads to visa', format: visaLabel },
  // Two questions, so two controls. Being an accredited sponsor is a formal
  // status with the Department; hiring international students is a hiring
  // habit. A company can do either without the other, and one control offering
  // both answers quietly asked the reader to treat them as the same question.
  { key: 'sponsor', label: 'Accredited sponsor', format: answerLabel, accent: true },
  {
    key: 'students',
    label: 'Hires international students',
    format: answerLabel,
    accent: true,
  },
];

/**
 * How many filters are narrowing the list right now. The collapsed filter bar
 * shows this, so hiding the controls never hides the fact that they are on.
 */
export function countActiveFilters(filters: FilterState): number {
  return (
    FIELDS.reduce((total, field) => total + filters[field.key].length, 0) +
    (filters.postedWithinDays > 0 ? 1 : 0) +
    (filters.query.trim() ? 1 : 0)
  );
}

interface Props {
  filters: FilterState;
  options: FilterOptions;
  /** How many roles each option would leave, keyed by filter then by value. */
  counts?: Partial<Record<FilterListKey | 'postedWithinDays', Map<string, number>>>;
  onChange: (next: FilterState) => void;
  onClear: () => void;
}

export function Filters({ filters, options, counts, onChange, onClear }: Props) {
  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });

  /**
   * A blank value is the "not specified" marker; it needs a label or it renders
   * as an unlabelled tick box.
   *
   * The field's own labeller gets first refusal on it, because "not specified"
   * is not always the truest word for a gap: on the two hand-checked columns a
   * blank means nobody has looked yet, which is a different claim. Labellers
   * with nothing to say about a blank return an empty string and fall through.
   */
  const label = (value: string, format?: (v: string) => string) =>
    (format ? format(value) : value) || NOT_SPECIFIED;

  const toOptions = (
    key: FilterListKey,
    values: string[],
    format?: (v: string) => string
  ): SelectOption[] =>
    values.map((value) => ({
      value,
      label: label(value, format),
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
        value: label(value, field.format),
        remove: () =>
          set({ [field.key]: filters[field.key].filter((v) => v !== value) } as Partial<FilterState>),
      });
    });
  });

  if (filters.postedWithinDays > 0) {
    chips.push({
      id: 'posted',
      field: 'Posted',
      value:
        POSTED_WINDOWS.find((w) => w.value === String(filters.postedWithinDays))?.label ?? '',
      remove: () => set({ postedWithinDays: 0 }),
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
            placeholder="Search company, title or occupation"
            value={filters.query}
            onChange={(e) => set({ query: e.target.value })}
          />
        </div>

        {FIELDS.map((field) => {
          const select = (
            <FilterSelect
              key={field.key}
              label={field.label}
              options={toOptions(field.key, options[field.key], field.format)}
              selected={filters[field.key]}
              onChange={(next) => set({ [field.key]: next } as Partial<FilterState>)}
            />
          );
          return field.accent ? (
            <div
              key={field.key}
              className={`fselect-sponsor${filters[field.key].length ? ' is-set' : ''}`}
            >
              {select}
            </div>
          ) : (
            select
          );
        })}

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

      </div>

      <ActiveFilters chips={chips} onClear={onClear} />
    </div>
  );
}
