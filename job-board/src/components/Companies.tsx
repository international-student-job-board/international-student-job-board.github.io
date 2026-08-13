import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
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
import { ActiveFilters, ActiveChip } from './ActiveFilters';
import { outboundHref } from '../outbound';
// Leaflet and its stylesheet are a big chunk of the site's weight, and only
// this page's map view needs them — split out so they download when someone
// actually asks for a map, not on every visit to the job board.
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

/**
 * The three answers the two hand-checked columns can hold. Blank means nobody
 * has looked yet, which is not "no", so it is labelled rather than left as an
 * unnamed tick box.
 */
const answerLabel = (value: string) =>
  value === 'yes' ? 'Yes' : value === 'no' ? 'No' : 'Not checked yet';

type CompanyFilterKey =
  | 'industries'
  | 'companyTypes'
  | 'growthStages'
  | 'hqCities'
  | 'openRoles'
  | 'sponsor'
  | 'students';

/**
 * Every filter on this page, defined once.
 *
 * They all behave the same way — pick any number of values, see how many
 * companies each would leave — so they are described rather than written out.
 * The counts are the reason this matters: each option is counted against
 * everything the *other* filters allow, and with a filter written out by hand
 * that meant a bespoke pool per filter, rewritten every time one was added.
 *
 * Names match the jobs page wherever the same thing is being filtered, so a
 * reader moving between the two pages meets one vocabulary.
 */
const FIELDS: {
  key: CompanyFilterKey;
  label: string;
  pick: (c: Company) => string[];
  format?: (value: string) => string;
  /** Fixed options, where they aren't read off the data. */
  values?: string[];
  /** Given the accent, because they are what this audience came for. */
  accent?: boolean;
}[] = [
  { key: 'industries', label: 'Industry', pick: (c) => c.industries, format: prettyLabel },
  { key: 'companyTypes', label: 'Model & tech', pick: (c) => c.types, format: prettyLabel },
  { key: 'growthStages', label: 'Stage', pick: (c) => [c.growthStage], format: prettyLabel },
  { key: 'hqCities', label: 'Head office', pick: (c) => [c.hqCity], format: prettyLabel },
  {
    key: 'openRoles',
    label: 'Open roles',
    // Whether, not how many: the count comes from the source file and is a
    // claim about the company's own careers page, not about roles on this
    // board. "Has some" is the part of it worth standing behind.
    pick: (c) => [c.openings > 0 ? 'yes' : 'no'],
    values: ['yes', 'no'],
    format: (v) => (v === 'yes' ? 'Has open roles' : 'None listed'),
  },
  {
    key: 'sponsor',
    label: 'Accredited sponsor',
    pick: (c) => [answerOf(c.accreditedSponsor)],
    format: answerLabel,
    accent: true,
  },
  {
    key: 'students',
    label: 'Hires international students',
    pick: (c) => [answerOf(c.hiresInternationalStudents)],
    format: answerLabel,
    accent: true,
  },
];

type CompanyFilters = Record<CompanyFilterKey, string[]>;

const NO_FILTERS: CompanyFilters = {
  industries: [],
  companyTypes: [],
  growthStages: [],
  hqCities: [],
  openRoles: [],
  sponsor: [],
  students: [],
};

const base = process.env.PUBLIC_URL || '';

const uniqueSorted = (values: string[]) => Array.from(new Set(values)).sort();

/**
 * Every company on the Melbourne list. The jobs page answers "what can I apply
 * for"; this answers "who is hiring" — a startup with openings we haven't
 * listed yet is still worth knowing about.
 */
export function Companies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<CompanyFilters>(NO_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(true);
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
   * Every value each filter could take, read off the data — except where the
   * options are fixed. A dropdown offering something no company has is a dead
   * end, so a value only appears if it would match.
   *
   * The blank "not specified" marker is offered only where a company actually
   * leaves that field empty.
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

  // Values within a filter are OR'd and separate filters are AND'd, matching
  // how the job board's filters behave — one rule to learn, not two. A company
  // with nothing in that field matches only when "not specified" is what was
  // asked for.
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
   * How many companies each option would leave, counted with that filter's own
   * selection lifted — otherwise every unpicked value in a filter you have
   * already used reads as zero, because that filter has just excluded them.
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

  const openings = shown.reduce((total, c) => total + c.openings, 0);
  const label = (value: string, format?: (v: string) => string) =>
    (format ? format(value) : value) || NOT_SPECIFIED;

  // Same chips as the job board: what is narrowing the list, readable at a
  // glance and undoable one at a time.
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
    <div className="about">
      <header className="about-intro">
        <h1>Startups and scaleups</h1>
        <p>
          Startups and scaleups found in Victoria, Australia.
        </p>
      </header>

      <section className="about-section" aria-labelledby="companies-heading">
      <p className="panel-banner">
         We're working through this list manually
         to confirm which startups sponsor visas and
         which hire international students. A company without those tags hasn't been checked
         yet, so it's worth asking them 'bout this directly.
        </p>
        {/* The same shape as the job board: a labelled toggle, then one bar
            holding the controls and the chips together. They were two blocks
            here, each with its own rule, which drew two lines across the page
            where the board draws one. */}
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

              {FIELDS.map((field) => {
                const select = (
                  <FilterSelect
                    label={field.label}
                    options={options[field.key].map((v) => ({
                      value: v,
                      // The field's own labeller gets first refusal on a blank,
                      // because "not specified" is not always the truest word for
                      // a gap — on the hand-checked columns it means nobody has
                      // looked yet, which is a different claim.
                      label: label(v, field.format),
                      count: counts[field.key].get(v) ?? 0,
                    }))}
                    selected={filters[field.key]}
                    onChange={(next) => setFilters((prev) => ({ ...prev, [field.key]: next }))}
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
                  <span key={field.key} className="fselect-wrap">
                    {select}
                  </span>
                );
              })}

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
            {/* Count on the left, view on the right, aligned on their shared
                baseline — the jobs panel heads its list the same way. */}
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
                    {shown.map((company) => (
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
          </>
        )}
      </section>
    </div>
  );
}

/**
 * Card hierarchy, most important first: who they are, what they do, whether
 * they can hire you, what field they're in, and the housekeeping last.
 *
 * The open-roles count is the ordinary chip rather than a filled badge. It sits
 * right beside the company name, and a solid pill there covers more surface
 * area than the name itself does, so it would win an argument it shouldn't be
 * having. Weight goes to the name; the count gets contrast instead.
 *
 * The name is the link, but its ::after covers the whole card, so clicking
 * anywhere opens their site while the markup keeps one link with a real name.
 * The LinkedIn link sits above that overlay, which is why it can live inside a
 * card that is otherwise entirely clickable.
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
  // Long industry lists crowd out everything under them; the rest stay in the
  // title so nothing is hidden outright.
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
            <li className="flag">Hires international students</li>
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
