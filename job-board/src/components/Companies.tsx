import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  Company,
  CompanySort,
  loadCompanies,
  searchCompanies,
  sortCompanies,
} from '../companies';
import { FilterSelect } from './FilterSelect';
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

/** The hand-checked flags, filtered the same way industries and types are. */
const REVIEW_FILTERS = [
  { value: 'sponsors', label: 'Sponsorship available' },
  { value: 'international', label: 'Hires international students' },
];

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
  const [industries, setIndustries] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [view, setView] = useState<View>('cards');
  const [sort, setSort] = useState<CompanySort>('openings');
  const [review, setReview] = useState<string[]>([]);
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

  const options = useMemo(
    () => ({
      industries: uniqueSorted(companies.flatMap((c) => c.industries)),
      types: uniqueSorted(companies.flatMap((c) => c.types)),
    }),
    [companies]
  );

  // Values within a filter are OR'd and the two filters are AND'd, matching how
  // the job board's filters behave — one rule to learn, not two.
  const shown = useMemo(() => {
    const overlaps = (selected: string[], values: string[]) =>
      selected.length === 0 || values.some((v) => selected.includes(v));

    const matchesReview = (c: Company) =>
      review.length === 0 ||
      review.some((r) =>
        r === 'sponsors' ? c.sponsorsVisas : c.hiresInternationalStudents
      );

    const filtered = searchCompanies(companies, query).filter(
      (c) =>
        overlaps(industries, c.industries) &&
        overlaps(types, c.types) &&
        matchesReview(c)
    );
    return sortCompanies(filtered, sort);
  }, [companies, query, industries, types, review, sort]);

  const openings = shown.reduce((total, c) => total + c.openings, 0);
  const applied = industries.length + types.length + review.length;

  return (
    <div className="about">
      <header className="about-intro">
        <h1>Startups currently hiring</h1>
        <p>
          Melbourne startups and scaleups with roles open right now! Not every open role is on our
          board yet, so go straight to the company if you vibe with the employer.
        </p>
      </header>

      <section className="about-section" aria-labelledby="companies-heading">
        <h2 id="companies-heading" className="visually-hidden">
          Companies
        </h2>

        {/* Context first, then the controls, then the results: the same order
            the jobs page reads in, so the two pages are learned once. */}
        <p className="panel-banner">
          We're working through this list by hand to confirm which startups sponsor visas and
          which hire international students. A company without those tags hasn't been checked
          yet, so it's worth asking them directly.
        </p>

        <div className="company-controls filter-row" role="search">
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

          <FilterSelect
            label="Industry"
            options={options.industries.map((v) => ({ value: v, label: v }))}
            selected={industries}
            onChange={setIndustries}
          />
          <FilterSelect
            label="Type"
            options={options.types.map((v) => ({ value: v, label: v }))}
            selected={types}
            onChange={setTypes}
          />
          <FilterSelect
            label="Visa support"
            options={REVIEW_FILTERS}
            selected={review}
            onChange={setReview}
          />
          <FilterSelect
            label="Sort"
            multiple={false}
            options={SORTS.map((s) => ({ value: s.value, label: s.label }))}
            selected={[sort]}
            onChange={(next) => setSort((next[0] as CompanySort) ?? 'openings')}
          />

          {applied > 0 && (
            <button
              type="button"
              className="filter-clear"
              onClick={() => {
                setIndustries([]);
                setTypes([]);
                setReview([]);
              }}
            >
              Clear filters
              <span className="filter-clear-count">{applied}</span>
            </button>
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
  const href = company.website || company.linkedin;
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
        <a
          className="company-card-name"
          href={outboundHref(href, 'startups')}
          target="_blank"
          rel="noopener"
            referrerPolicy="strict-origin-when-cross-origin"
        >
          {company.name}
        </a>
        {company.openings > 0 && (
          <span className="company-card-openings">
            {company.openings} open {company.openings === 1 ? 'role' : 'roles'}
          </span>
        )}
      </div>

      {company.tagline && <p className="company-card-tagline">{company.tagline}</p>}

      {(company.sponsorsVisas || company.hiresInternationalStudents) && (
        <ul className="company-card-flags" aria-label="Visa support">
          {company.sponsorsVisas && (
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
