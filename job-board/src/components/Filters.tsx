import { resolveOccupation, VISA_NAMES } from '../references';

const base = process.env.PUBLIC_URL || '';

export interface FilterState {
  query: string;
  type: string;
  level: string;
  arrangement: string;
  visa: string;
  pathwayVisa: string;
  anzsco: string;
  skillAssessment: string;
  salaryMin: number;
  skills: string[];
  sponsoredOnly: boolean;
}

// "261313" -> "261313 Software Engineer" for the ANZSCO dropdown labels.
const anzscoLabel = (code: string) => {
  const { name } = resolveOccupation(code, '');
  return name ? `${code} ${name}` : code;
};

// "189" -> "189 - Skilled Independent" for the two visa dropdowns. Codes with
// no entry in VISA_NAMES fall back to the bare code.
const visaLabel = (code: string) => {
  const name = VISA_NAMES[code.trim()];
  return name ? `${code} - ${name}` : code;
};

const SALARY_BANDS = [
  { value: 40000, label: '$40k+' },
  { value: 60000, label: '$60k+' },
  { value: 80000, label: '$80k+' },
  { value: 100000, label: '$100k+' },
];

export interface FilterOptions {
  types: string[];
  levels: string[];
  arrangements: string[];
  visas: string[];
  pathwayVisas: string[];
  anzscos: string[];
  skillAssessments: string[];
  skills: string[];
}

interface Props {
  filters: FilterState;
  options: FilterOptions;
  onChange: (next: FilterState) => void;
  onClear: () => void;
}

export function Filters({ filters, options, onChange, onClear }: Props) {
  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });

  const activeCount =
    (filters.query ? 1 : 0) +
    (filters.type ? 1 : 0) +
    (filters.level ? 1 : 0) +
    (filters.arrangement ? 1 : 0) +
    (filters.visa ? 1 : 0) +
    (filters.pathwayVisa ? 1 : 0) +
    (filters.anzsco ? 1 : 0) +
    (filters.skillAssessment ? 1 : 0) +
    (filters.salaryMin > 0 ? 1 : 0) +
    filters.skills.length +
    (filters.sponsoredOnly ? 1 : 0);

  const toggleSkill = (skill: string) => {
    const skills = filters.skills.includes(skill)
      ? filters.skills.filter((s) => s !== skill)
      : [...filters.skills, skill];
    set({ skills });
  };

  const selects: {
    key: keyof FilterState;
    label: string;
    all: string;
    values: string[];
    format?: (value: string) => string;
  }[] = [
    { key: 'type', label: 'Job type', all: 'Any type', values: options.types },
    { key: 'level', label: 'Level', all: 'Any level', values: options.levels },
    { key: 'arrangement', label: 'Arrangement', all: 'Anywhere', values: options.arrangements },
    { key: 'visa', label: 'Apply on visa', all: 'Any current visa', values: options.visas, format: visaLabel },
    { key: 'pathwayVisa', label: 'Leads to visa', all: 'Any pathway visa', values: options.pathwayVisas, format: visaLabel },
    { key: 'anzsco', label: 'ANZSCO occupation', all: 'Any occupation', values: options.anzscos, format: anzscoLabel },
    { key: 'skillAssessment', label: 'Skills assessment', all: 'Any assessor', values: options.skillAssessments },
  ];

  return (
    <div className="filterbar" role="search">
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

      {selects.map((s) => (
        <label key={s.key} className="filter-field">
          <span className="visually-hidden">{s.label}</span>
          <select
            value={filters[s.key] as string}
            onChange={(e) => set({ [s.key]: e.target.value } as Partial<FilterState>)}
          >
            <option value="">{s.all}</option>
            {s.values.map((v) => (
              <option key={v} value={v}>
                {s.format ? s.format(v) : v}
              </option>
            ))}
          </select>
        </label>
      ))}

      <label className="filter-field">
        <span className="visually-hidden">Minimum annual salary</span>
        <select
          value={String(filters.salaryMin)}
          onChange={(e) => set({ salaryMin: Number(e.target.value) })}
        >
          <option value="0">Any salary</option>
          {SALARY_BANDS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
      </label>

      <details className="tags-filter">
        <summary>
          Skills
          {filters.skills.length > 0 && <span className="tags-count">{filters.skills.length}</span>}
        </summary>
        <fieldset className="tags-options">
          <legend className="visually-hidden">Filter by skills</legend>
          {options.skills.map((skill) => (
            <label key={skill} className="tag-check">
              <input
                type="checkbox"
                checked={filters.skills.includes(skill)}
                onChange={() => toggleSkill(skill)}
              />
              {skill}
            </label>
          ))}
        </fieldset>
      </details>

      <label className="chip-toggle chip-sponsor">
        <input
          type="checkbox"
          checked={filters.sponsoredOnly}
          onChange={(e) => set({ sponsoredOnly: e.target.checked })}
        />
        Visa sponsorship available
      </label>

      {activeCount > 0 && (
        <button type="button" className="filter-clear" onClick={onClear}>
          Clear filters
          <span className="filter-clear-count">{activeCount}</span>
        </button>
      )}
    </div>
  );
}
