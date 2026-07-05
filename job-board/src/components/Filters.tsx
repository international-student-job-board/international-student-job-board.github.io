const base = process.env.PUBLIC_URL || '';

export interface FilterState {
  query: string;
  type: string;
  level: string;
  arrangement: string;
  visa: string;
  pathwayVisa: string;
  salaryMin: number;
  skills: string[];
  sponsoredOnly: boolean;
}

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
  skills: string[];
}

interface Props {
  filters: FilterState;
  options: FilterOptions;
  onChange: (next: FilterState) => void;
}

export function Filters({ filters, options, onChange }: Props) {
  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });

  const toggleSkill = (skill: string) => {
    const skills = filters.skills.includes(skill)
      ? filters.skills.filter((s) => s !== skill)
      : [...filters.skills, skill];
    set({ skills });
  };

  const selects: { key: keyof FilterState; label: string; all: string; values: string[] }[] = [
    { key: 'type', label: 'Job type', all: 'Any type', values: options.types },
    { key: 'level', label: 'Level', all: 'Any level', values: options.levels },
    { key: 'arrangement', label: 'Arrangement', all: 'Anywhere', values: options.arrangements },
    { key: 'visa', label: 'Apply on visa', all: 'Any current visa', values: options.visas },
    { key: 'pathwayVisa', label: 'Leads to visa', all: 'Any pathway visa', values: options.pathwayVisas },
  ];

  return (
    <div className="filterbar" role="search">
      <div className="filter-search">
        <label className="visually-hidden" htmlFor="job-search">
          Search jobs
        </label>
        <img
          className="search-icon"
          src={`${base}/icons/search.svg`}
          alt=""
          aria-hidden="true"
          width={18}
          height={22}
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
                {v}
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
    </div>
  );
}
