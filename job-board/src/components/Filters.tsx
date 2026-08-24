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
import { NOT_SPECIFIED } from '../format';
import { prettyLabel } from '../labels';
import { ActiveFilters, ActiveChip } from './ActiveFilters';
import { FilterSelect, SelectOption } from './FilterSelect';

const base = process.env.PUBLIC_URL || '';

/**
 * Every dimension holds a list, so a student can ask for (say) two pathway visas and three
 * occupations at once.
 */
export interface FilterState {
  query: string;
  companies: string[];
  states: string[];
  types: string[];
  cities: string[];
  industries: string[];
  /** The company's own tags — what it makes and how it makes money. */
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
}

/** The list-valued keys, which are exactly the keys of FilterOptions. */
export type FilterListKey =
  | 'companies'
  | 'states'
  | 'types'
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

// "261313 - Software Engineer (min. 65)" — the score is the same for every job carrying
// this code, so it reads as a fact about the occupation rather than about any one role.
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

// Single-choice: asking for "within a week" and "within a month" at once only ever means a
// month.
const POSTED_WINDOWS = [
  { value: '1', label: 'Last 24 hours' },
  { value: '2', label: 'Last 2 days' },
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last month' },
  { value: '60', label: 'Last 2 months' },
];

/** The three answers the two hand-checked columns can hold. */
const answerLabel = (value: string) =>
  value === 'yes' ? 'Yes' : value === 'no' ? 'No' : 'Not checked yet';

const FIELDS: {
  key: FilterListKey;
  label: string;
  format?: (value: string) => string;
  /** Shown on an "i" in the open panel, beside the count. */
  tooltip?: string;
  /** A source link in the same footer, beside the tooltip. */
  footerLink?: { label: string; href: string };
  /** Given the accent, because it is what this audience came for. */
  accent?: boolean;
}[] = [
  { key: 'companies', label: 'Company' },
  { key: 'states', label: 'State' },
  { key: 'types', label: 'Job type', format: prettyLabel },
  { key: 'cities', label: 'Location', format: prettyLabel },
  { key: 'industries', label: 'Industry', format: prettyLabel },
  // Named the same as the fact on the job detail page.
  { key: 'companyTypes', label: 'Model & tech', format: prettyLabel },
  // The growth stage on its own, not the "startup · early stage" pair the detail page
  // shows.
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
  // Two questions, so two controls.
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

/**
 * The filters, in groups.
 *
 * Fifteen controls in one row is a wall: nothing says that State and Location
 * answer the same question while Stage answers another, so the whole set has to
 * be read before any of it can be used. The grouping is carried by spacing —
 * more space around a group than within it — which is the rule Refactoring UI
 * gives for grouping without a visible separator.
 */
const GROUPS: { title: string; keys: (FilterListKey | 'posted')[] }[] = [
  { title: 'Where', keys: ['states', 'cities', 'hqCities'] },
  { title: 'The role', keys: ['types', 'posted'] },
  { title: 'The employer', keys: ['companies', 'industries', 'companyTypes', 'growthStages'] },
  {
    title: 'Occupation and visa',
    keys: ['invitedOccupations', 'anzscos', 'unitGroups', 'oscas', 'occupationLists', 'pathwayVisas'],
  },
  { title: 'Hiring', keys: ['sponsor', 'students'] },
];

/** How many filters are narrowing the list right now. */
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

const BY_KEY = new Map(FIELDS.map((f) => [f.key, f]));

export function Filters({ filters, options, counts, onChange, onClear }: Props) {
  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });

  /**
   * A blank value is the "not specified" marker; it needs a label or it renders as an
   * unlabelled tick box.
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

  // Rather than a bare count, each selection gets its own chip below the row, so what is
  // currently narrowing the list is readable at a glance and can be undone one at a time.
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

        {GROUPS.map((group) => (
          <div className="filter-group" key={group.title}>
            {group.keys.map((key) => {
              if (key === 'posted') {
                return (
                  <FilterSelect
                    key="posted"
                    label="Posted"
                    multiple={false}
                    options={POSTED_WINDOWS.map((w) => ({
                      ...w,
                      count: counts?.postedWithinDays?.get(w.value) ?? 0,
                    }))}
                    selected={
                      filters.postedWithinDays > 0 ? [String(filters.postedWithinDays)] : []
                    }
                    onChange={(next) => set({ postedWithinDays: Number(next[0] ?? 0) })}
                  />
                );
              }

              const field = BY_KEY.get(key);
              if (!field) return null;
              const select = (
                <FilterSelect
                  key={field.key}
                  label={field.label}
                  tooltip={field.tooltip}
                  footerLink={field.footerLink}
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
          </div>
        ))}
      </div>

      <ActiveFilters chips={chips} onClear={onClear} />
    </div>
  );
}
