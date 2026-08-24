import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  Company,
  CompanySort,
  loadCompanies,
  searchCompanies,
  sortCompanies,
} from '../companies';
import { FilterSelect } from './FilterSelect';
import { NOT_SPECIFIED } from '../format';
import { prettyLabel } from '../labels';
import { MANUAL_REVIEW_NOTE } from '../references';
import { ActiveFilters, ActiveChip } from './ActiveFilters';
import { outboundHref } from '../outbound';
// Leaflet and its stylesheet are a big chunk of the site's weight, and only this page's map
// view needs them — split out so they download when someone actually asks for a map, not on
// every visit to the job board.
const CompanyMap = lazy(() =>
  import('./CompanyMap').then((m) => ({ default: m.CompanyMap }))
);

type View = 'cards' | 'split' | 'map';

const VIEWS: { key: View; label: string }[] = [
  { key: 'cards', label: 'Cards' },
  { key: 'split', label: 'Split' },
  { key: 'map', label: 'Map' },
];

const SORTS: { value: CompanySort; label: string }[] = [
  { value: 'openings', label: 'Most roles open' },
  { value: 'name', label: 'A to Z' },
];

/** A hand-checked column as a filter value. */
const answerOf = (value: boolean | undefined) =>
  value === true ? 'yes' : value === false ? 'no' : '';

/** The three answers the two hand-checked columns can hold. */
const answerLabel = (value: string) =>
  value === 'yes' ? 'Yes' : value === 'no' ? 'No' : 'Not checked yet';

type CompanyFilterKey =
  | 'states'
  | 'industries'
  | 'companyTypes'
  | 'growthStages'
  | 'hqCities'
  | 'openRoles'
  | 'sponsor'
  | 'students';

/** Every filter on this page, defined once. */
const FIELDS: {
  key: CompanyFilterKey;
  label: string;
  pick: (c: Company) => string[];
  format?: (value: string) => string;
  /** Fixed options, where they aren't read off the data. */
  values?: string[];
  /** Shown on an "i" in the open panel, beside the count. */
  tooltip?: string;
  /** Given the accent, because they are what this audience came for. */
  accent?: boolean;
}[] = [
  { key: 'states', label: 'State', pick: (c) => [c.state] },
  { key: 'industries', label: 'Industry', pick: (c) => c.industries, format: prettyLabel },
  { key: 'companyTypes', label: 'Model & tech', pick: (c) => c.types, format: prettyLabel },
  { key: 'growthStages', label: 'Stage', pick: (c) => [c.growthStage], format: prettyLabel },
  { key: 'hqCities', label: 'Head office', pick: (c) => [c.hqCity], format: prettyLabel },
  {
    key: 'openRoles',
    label: 'Open roles',
    // Whether, not how many: the count comes from the source file and is a claim about the
    // company's own careers page, not about roles on this board.
    pick: (c) => [c.openings > 0 ? 'yes' : 'no'],
    values: ['yes', 'no'],
    format: (v) => (v === 'yes' ? 'Has open roles' : 'None listed'),
  },
  {
    key: 'sponsor',
    label: 'Accredited sponsor',
    pick: (c) => [answerOf(c.accreditedSponsor)],
    format: answerLabel,
    tooltip: MANUAL_REVIEW_NOTE,
    accent: true,
  },
  {
    key: 'students',
    label: 'Hires international students and graduates',
    pick: (c) => [answerOf(c.hiresInternationalStudents)],
    format: answerLabel,
    tooltip: MANUAL_REVIEW_NOTE,
    accent: true,
  },
];

/** The same grouping the job board uses, so the two pages read alike. */
const GROUPS: { title: string; keys: CompanyFilterKey[] }[] = [
  { title: 'Where', keys: ['states', 'hqCities'] },
  { title: 'The company', keys: ['industries', 'companyTypes', 'growthStages', 'openRoles'] },
  { title: 'Hiring', keys: ['sponsor', 'students'] },
];

const BY_KEY = new Map(FIELDS.map((f) => [f.key, f]));

type CompanyFilters = Record<CompanyFilterKey, string[]>;

const NO_FILTERS: CompanyFilters = {
  states: [],
  industries: [],
  companyTypes: [],
  growthStages: [],
  hqCities: [],
  openRoles: [],
  sponsor: [],
  students: [],
};

const base = process.env.PUBLIC_URL || '';

/**
 * Cards per page.
 *
 * The list is 15,000 companies; rendering all of them is a browser laid out
 * flat before it can paint anything. The map is exempt — it draws one pin per
 * suburb, not one per company, and a map showing 25 of 15,000 would say
 * something false about where the companies are.
 */
const PAGE_SIZE = 25;

const uniqueSorted = (values: string[]) => Array.from(new Set(values)).sort();

/** Every company on the national list. */
export function Companies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<CompanyFilters>(NO_FILTERS);
  // Closed to begin with: the results are what the page is for, and a wall of
  // controls above them asks a first-time reader to make decisions before they
  // have seen anything to decide about. The toggle carries a count, so an
  // active filter is never hidden.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const topRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>('cards');
  const [sort, setSort] = useState<CompanySort>('openings');
  // Which card the pointer is on, so the map can open that suburb alongside it.
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    loadCompanies()
      .then((data) => {
        setCompanies(data);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, []);

  /**
   * Every value each filter could take, read off the data — except where the options are
   * fixed.
   */
  const options = useMemo(() => {
    const built = {} as Record<CompanyFilterKey, string[]>;
    for (const field of FIELDS) {
      if (field.values) {
        const present = new Set(companies.flatMap(field.pick));
        built[field.key] = field.values.filter((v) => present.has(v));
        continue;
      }
      const values = uniqueSorted(companies.flatMap(field.pick).filter(Boolean));
      const anyBlank = companies.some((c) => field.pick(c).filter(Boolean).length === 0);
      built[field.key] = anyBlank ? [...values, ''] : values;
    }
    return built;
  }, [companies]);

  // Values within a filter are OR'd and separate filters are AND'd, matching how the job
  // board's filters behave — one rule to learn, not two.
  const overlaps = (selected: string[], values: string[]) =>
    selected.length === 0 ||
    (values.filter(Boolean).length
      ? values.some((v) => selected.includes(v))
      : selected.includes(''));

  const matches = (c: Company, active: CompanyFilters) =>
    FIELDS.every((field) => overlaps(active[field.key], field.pick(c)));

  const shown = useMemo(() => {
    const filtered = searchCompanies(companies, query).filter((c) => matches(c, filters));
    return sortCompanies(filtered, sort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companies, query, filters, sort]);

  /**
   * How many companies each option would leave, counted with that filter's own selection
   * lifted — otherwise every unpicked value in a filter you have already used reads as
   * zero, because that filter has just excluded them.
   */
  const counts = useMemo(() => {
    const pool = searchCompanies(companies, query);
    const built = {} as Record<CompanyFilterKey, Map<string, number>>;

    for (const field of FIELDS) {
      const without = pool.filter((c) => matches(c, { ...filters, [field.key]: [] }));
      const counted = new Map<string, number>();
      without.forEach((c) => {
        const values = field.pick(c).filter(Boolean);
        const keys = values.length ? Array.from(new Set(values)) : [''];
        keys.forEach((v) => counted.set(v, (counted.get(v) ?? 0) + 1));
      });
      built[field.key] = counted;
    }
    return built;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companies, query, filters]);

  // Back to the first page whenever the list underneath changes, so you are
  // never left on page 40 of a set that now has three.
  useEffect(() => {
    setPage(1);
  }, [query, filters, sort]);

  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageCompanies = shown.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  /**
   * Turning a page puts you at the top of the new one.
   *
   * scrollIntoView rather than window.scrollTo, because on this page the window
   * isn't what scrolls: the content sits in .about-panel, which has its own
   * overflow. Asking the top of the list to come into view works whichever
   * ancestor is doing the scrolling — the panel on a wide screen, the window
   * once the panes stack. The window call stays for the stacked case, where
   * there is a page scroll to reset as well.
   */
  const goToPage = (next: number) => {
    setPage(next);
    topRef.current?.scrollIntoView?.({ block: 'start' });
    window.scrollTo?.({ top: 0 });
  };

  const openings = shown.reduce((total, c) => total + c.openings, 0);
  const label = (value: string, format?: (v: string) => string) =>
    (format ? format(value) : value) || NOT_SPECIFIED;

  // Same chips as the job board: what is narrowing the list, readable at a glance and
  // undoable one at a time.
  const chips: ActiveChip[] = FIELDS.flatMap((field) =>
    filters[field.key].map((value) => ({
      id: `${field.key}:${value}`,
      field: field.label,
      value: label(value, field.format),
      remove: () =>
        setFilters((prev) => ({
          ...prev,
          [field.key]: prev[field.key].filter((v) => v !== value),
        })),
    }))
  );

  return (
    <div className="about" ref={topRef}>
      <header className="page-intro">
        <h1 id="companies-heading">Startups and scaleups founded in Australia</h1>
      </header>

      <section className="about-section" aria-labelledby="companies-heading">
        <div className="filters-region companies-filters">
          <button
            type="button"
            className="filters-toggle"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            Filters
            {chips.length > 0 && (
              <span className="filters-toggle-count">
                {chips.length}
                <span className="visually-hidden"> active</span>
              </span>
            )}
          </button>

          {filtersOpen && (
            <div className="filterbar" role="search">
            <div className="filter-row">
              <div className="filter-search">
                <label className="visually-hidden" htmlFor="company-search">
                  Search companies
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
                  id="company-search"
                  type="search"
                  placeholder="Search by name, industry or what they build"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              {GROUPS.map((group) => (
                <div className="filter-group" key={group.title}>
                  {group.keys.map((key) => {
                    const field = BY_KEY.get(key);
                    if (!field) return null;
                    const select = (
                      <FilterSelect
                        key={field.key}
                        label={field.label}
                        tooltip={field.tooltip}
                        options={options[field.key].map((v) => ({
                          value: v,
                          label: label(v, field.format),
                          count: counts[field.key].get(v) ?? 0,
                        }))}
                        selected={filters[field.key]}
                        onChange={(next) =>
                          setFilters((prev) => ({ ...prev, [field.key]: next }))
                        }
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

              <FilterSelect
                label="Sort"
                multiple={false}
                options={SORTS.map((s) => ({ value: s.value, label: s.label }))}
                selected={[sort]}
                onChange={(next) => setSort((next[0] as CompanySort) ?? 'openings')}
              />

            </div>


              <ActiveFilters chips={chips} onClear={() => setFilters(NO_FILTERS)} />
            </div>
          )}
        </div>

        {status === 'loading' && <p className="panel-note">Loading companies . . .</p>}
        {status === 'error' && (
          <p className="panel-note" role="alert">
            Sorry, we couldn't load the company list right now. Please try again later.
          </p>
        )}

        {status === 'ready' && (
          <>
            <div className="jobs-head company-head">
              <p className="result-count" aria-live="polite">
                {shown.length} {shown.length === 1 ? 'company' : 'companies'}
                {openings > 0 && ` · ${openings} open roles`}
              </p>

              <div className="view-toggle" role="group" aria-label="How to show the companies">
                {VIEWS.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    className={`view-toggle-btn${view === v.key ? ' is-on' : ''}`}
                    aria-pressed={view === v.key}
                    onClick={() => setView(v.key)}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {shown.length === 0 ? (
              <p className="panel-note">No company matches what you're looking for.</p>
            ) : (
              <div className={`company-views is-${view}`}>
                {view !== 'cards' && (
                  <Suspense
                    fallback={<div className="company-map-canvas is-loading" aria-hidden="true" />}
                  >
                    <CompanyMap companies={shown} highlight={hovered} />
                  </Suspense>
                )}
                {view !== 'map' && (
                  <ul className="company-grid">
                    {pageCompanies.map((company) => (
                      <CompanyCard
                        key={company.name}
                        company={company}
                        onHover={view === 'split' ? setHovered : undefined}
                      />
                    ))}
                  </ul>
                )}
              </div>
            )}

            {view !== 'map' && totalPages > 1 && (
              <nav className="pagination" aria-label="Company pages">
                <button
                  type="button"
                  className="page-btn"
                  disabled={currentPage === 1}
                  onClick={() => goToPage(currentPage - 1)}
                >
                  Prev
                </button>
                <span className="page-status" aria-live="polite">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  className="page-btn"
                  disabled={currentPage === totalPages}
                  onClick={() => goToPage(currentPage + 1)}
                >
                  Next
                </button>
              </nav>
            )}
          </>
        )}
      </section>
    </div>
  );
}

/**
 * Card hierarchy, most important first: who they are, what they do, whether they can hire
 * you, what field they're in, and the housekeeping last.
 */
function CompanyCard({
  company,
  onHover,
}: {
  company: Company;
  onHover?: (name: string | null) => void;
}) {
  const href = outboundHref(company.website || company.linkedin, 'startups');
  const meta = [company.segment, company.employees && `${company.employees} people`]
    .filter(Boolean)
    .join(' · ');
  // Long industry lists crowd out everything under them; the rest stay in the title so
  // nothing is hidden outright.
  const industries = company.industries.slice(0, 3);
  const extraIndustries = company.industries.length - industries.length;

  return (
    <li
      className="company-card"
      onMouseEnter={() => onHover?.(company.name)}
      onMouseLeave={() => onHover?.(null)}
      // Focus as well as hover, so the map follows a keyboard too.
      onFocus={() => onHover?.(company.name)}
      onBlur={() => onHover?.(null)}
    >
      <div className="company-card-head">
        {href ? (
          <a
            className="company-card-name"
            href={href}
            target="_blank"
            rel="noopener"
            referrerPolicy="strict-origin-when-cross-origin"
          >
            {company.name}
          </a>
        ) : (
          <span className="company-card-name">{company.name}</span>
        )}
        {company.openings > 0 && (
          <span className="company-card-openings">
            {company.openings} open {company.openings === 1 ? 'role' : 'roles'}
          </span>
        )}
      </div>

      {company.tagline && <p className="company-card-tagline">{company.tagline}</p>}

      {(company.accreditedSponsor || company.hiresInternationalStudents) && (
        <ul className="company-card-flags" aria-label="Visa support">
          {company.accreditedSponsor && (
            <li className="flag flag-sponsor">Visa sponsorship available</li>
          )}
          {company.hiresInternationalStudents && (
            <li className="flag flag-sponsor">Hires international students and graduates</li>
          )}
        </ul>
      )}

      <div className="company-card-foot">
        {industries.length > 0 && (
          <ul
            className="company-card-tags"
            aria-label="Industries"
            title={company.industries.join(', ')}
          >
            {industries.map((industry) => (
              <li key={industry} className="company-tag">
                {industry}
              </li>
            ))}
            {extraIndustries > 0 && (
              <li className="company-tag company-tag-more">+{extraIndustries}</li>
            )}
          </ul>
        )}

        <p className="company-card-meta">
          <span>{[meta, company.types.slice(0, 2).join(' · ')].filter(Boolean).join(' · ')}</span>
          {company.linkedin && (
            <a
              className="company-linkedin"
              href={outboundHref(company.linkedin, 'startups')}
              target="_blank"
              rel="noopener"
            referrerPolicy="strict-origin-when-cross-origin"
            >
              LinkedIn
            </a>
          )}
        </p>
      </div>
    </li>
  );
}
