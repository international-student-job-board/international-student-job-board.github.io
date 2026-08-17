import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { Job, jobLocation } from './types';
import { loadJobs, isRecent, MONTHS_LISTED } from './jobs';
import { loadCompanies } from './companies';
import { dateValue, todayISO } from './format';
import {
  pathwayVisasFor,
  occupationCodesFor,
  occupationListsFor,
  oscaCodesFor,
  unitGroupCodesFor,
} from './references';
import { Header } from './components/Header';
import { Route, parsePath, pathFor, pathFromLegacyHash } from './routes';
import { applyMeta, applySchema, metaFor, jobPostingSchema, websiteSchema } from './seo';
import { trackPageView } from './analytics';
import {
  Filters,
  FilterState,
  FilterOptions,
  FilterListKey,
  countActiveFilters,
} from './components/Filters';
import { JobCard } from './components/JobCard';
import { JobDetail } from './components/JobDetail';
import { About } from './components/About';
import { PostJob } from './components/PostJob';
import { Companies } from './components/Companies';

import { Footer } from './components/Footer';
/**
 * Split out so the admin and everything only it uses — the occupation writer, the constant
 * pickers, the tag editors — stay out of the bundle visitors download.
 */
const AdminAddJob = lazy(() =>
  import('./components/AdminAddJob').then((m) => ({ default: m.AdminAddJob }))
);


const PAGE_SIZE = 10;

const EMPTY_FILTERS: FilterState = {
  query: '',
  companies: [],
  states: [],
  types: [],
  cities: [],
  industries: [],
  companyTypes: [],
  growthStages: [],
  hqCities: [],
  anzscos: [],
  unitGroups: [],
  oscas: [],
  occupationLists: [],
  pathwayVisas: [],
  sponsor: [],
  students: [],
  postedWithinDays: 0,
};

/** The value a filter uses to mean "roles that don't say". */
export const UNSPECIFIED = '';

/** An empty filter narrows nothing; otherwise the job's value has to be in it. */
const allows = (selected: string[], value: string) =>
  selected.length === 0 || selected.includes(value.trim());

/** Same, for the fields where the job itself holds a list (occupations, visas). */
const overlaps = (selected: string[], values: string[]) =>
  selected.length === 0 ||
  (values.length
    ? values.some((value) => selected.includes(value))
    : selected.includes(UNSPECIFIED));

/** A hand-checked yes/no/nobody-said column as a filter value. */
const answer = (value: boolean | undefined): string[] => [
  value === true ? 'yes' : value === false ? 'no' : UNSPECIFIED,
];

/**
 * `postedAfter` is a timestamp resolved once per pass rather than per job, so every card in
 * one run is measured against the same instant. 0 means the recency filter is off.
 */
function matches(job: Job, filters: FilterState, postedAfter: number): boolean {
  if (!allows(filters.companies, job.company.name)) return false;
  if (!allows(filters.states, job.state)) return false;
  if (!allows(filters.types, job.type)) return false;
  if (!allows(filters.cities, job.city)) return false;
  if (!overlaps(filters.industries, job.company.industries)) return false;
  if (!overlaps(filters.companyTypes, job.company.types)) return false;
  if (!allows(filters.growthStages, job.company.growthStage)) return false;
  if (!allows(filters.hqCities, job.company.hqCity)) return false;
  // A role can map to several occupations, so it matches if any of them do.
  if (!overlaps(filters.anzscos, occupationCodesFor(job))) return false;
  // The occupations' own visas are what the detail page shows as pathways, so filtering
  // reads the same function — a role can always be found by the visas it is shown to offer.
  if (!overlaps(filters.unitGroups, unitGroupCodesFor(job))) return false;
  if (!overlaps(filters.oscas, oscaCodesFor(job))) return false;
  if (!overlaps(filters.occupationLists, occupationListsFor(job))) return false;
  if (!overlaps(filters.pathwayVisas, pathwayVisasFor(job))) return false;
  if (!overlaps(filters.sponsor, answer(job.company.accreditedSponsor))) return false;
  if (!overlaps(filters.students, answer(job.company.hiresInternationalStudents))) return false;

  // A role we can't date can't be shown to be recent, so it drops out when the reader asks
  // for recent ones.
  if (postedAfter > 0) {
    const posted = dateValue(job.posted);
    if (!Number.isFinite(posted) || posted < postedAfter) return false;
  }

  const q = filters.query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    job.title,
    job.company.name,
    jobLocation(job),
    ...job.occupationNames,
    ...job.company.industries,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The recency filter, resolved to an instant for one filtering pass. */
const cutoff = (filters: FilterState): number =>
  filters.postedWithinDays > 0 ? Date.now() - filters.postedWithinDays * DAY_MS : 0;

const uniqueSorted = (values: string[]) => Array.from(new Set(values)).sort();

/** When a listing stops being true, for the structured data's validThrough. */
function lapseDate(posted: string, months: number): string {
  const date = new Date(`${posted}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

export { IS_LOCAL, jobShareUrl } from './routes';

function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // On mobile the list and detail are separate "pages"; this flips to the detail page when
  // a job is tapped.
  const [showDetail, setShowDetail] = useState(false);
  const [route, setRoute] = useState<Route>(() => parsePath(window.location.pathname).route);
  const [page, setPage] = useState(1);
  // Closed to begin with: the results are what the page is for, and a wall of
  // controls above them asks a first-time reader to make decisions before they
  // have seen anything to decide about. The toggle carries a count, so an
  // active filter is never hidden.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const detailRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLElement>(null);

  useEffect(() => {
    loadJobs()
      .then((data) => {
        setJobs(data);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, []);

  /**
   * The address is the source of truth for what is on screen, read on arrival and on every
   * back/forward step.
   */
  useEffect(() => {
    const legacy = pathFromLegacyHash(window.location.hash);
    if (legacy) window.history.replaceState(null, '', legacy);

    const read = () => {
      const here = parsePath(window.location.pathname);
      setRoute(here.route);
      if (here.jobId) {
        setSelectedId(here.jobId);
        setShowDetail(true);
      } else {
        setShowDetail(false);
      }
    };

    /** Internal links navigate in place rather than reloading the whole app. */
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const link = (event.target as HTMLElement | null)?.closest?.('a');
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;

      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;

      event.preventDefault();
      if (url.pathname !== window.location.pathname) {
        window.history.pushState(null, '', url.pathname);
        window.scrollTo({ top: 0 });
      }
      read();
    };

    read();
    window.addEventListener('popstate', read);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('popstate', read);
      document.removeEventListener('click', onClick);
    };
  }, []);

  const openJob = (id: string) => {
    setSelectedId(id);
    setShowDetail(true);
    // replaceState rather than pushState: picking through a list shouldn't bury the page
    // you arrived from under twenty back-button steps.
    window.history.replaceState(null, '', pathFor('jobs', id));
    window.scrollTo({ top: 0 });
  };

  /** Turning a page puts you at the top of the new one. */
  const goToPage = (next: number) => {
    setPage(next);
    listRef.current?.scrollTo?.({ top: 0 });
    window.scrollTo?.({ top: 0 });
  };

  // Back to page 1 whenever the filters change.
  useEffect(() => {
    setPage(1);
  }, [filters]);

  // Stale roles are dropped here rather than inside the filtering, so they are gone from
  // everything downstream: the count, the default selection, and the filter dropdowns —
  // which would otherwise offer a company or an occupation that no listed role has.
  const openJobs = useMemo(() => {
    const today = todayISO();
    return jobs.filter((job) => isRecent(job, today));
  }, [jobs]);

  /**
   * How many roles each option would leave, counted against everything the *other* filters
   * allow — not against the whole board and not against the current results.
   */
  const counts = useMemo(() => {
    const postedAfter = cutoff(filters);
    const without = (key: FilterListKey) =>
      openJobs.filter((job) => matches(job, { ...filters, [key]: [] }, postedAfter));

    const tally = (list: Job[], pick: (job: Job) => string[]) => {
      const counted = new Map<string, number>();
      list.forEach((job) => {
        const values = pick(job).filter(Boolean);
        const keys = values.length ? Array.from(new Set(values)) : [UNSPECIFIED];
        keys.forEach((key) => counted.set(key, (counted.get(key) ?? 0) + 1));
      });
      return counted;
    };

    const pickers: Record<FilterListKey, (job: Job) => string[]> = {
      companies: (j) => [j.company.name],
      states: (j) => [j.state],
      types: (j) => [j.type],
      cities: (j) => [j.city],
      industries: (j) => j.company.industries,
      companyTypes: (j) => j.company.types,
      growthStages: (j) => [j.company.growthStage],
      hqCities: (j) => [j.company.hqCity],
      anzscos: occupationCodesFor,
      unitGroups: unitGroupCodesFor,
      oscas: oscaCodesFor,
      occupationLists: occupationListsFor,
      pathwayVisas: pathwayVisasFor,
      sponsor: (j) => answer(j.company.accreditedSponsor),
      students: (j) => answer(j.company.hiresInternationalStudents),
    };

    const byFilter = Object.fromEntries(
      (Object.keys(pickers) as FilterListKey[]).map((key) => [
        key,
        tally(without(key), pickers[key]),
      ])
    ) as Record<FilterListKey, Map<string, number>>;

    /**
     * The recency filter can't be tallied by walking a job's values, because its options
     * are thresholds rather than things a job "has".
     */
    const postedCounts = new Map<string, number>();
    ['1', '2', '7', '14', '30', '60'].forEach((value) => {
      const asked = { ...filters, postedWithinDays: Number(value) };
      postedCounts.set(value, openJobs.filter((job) => matches(job, asked, cutoff(asked))).length);
    });

    return { ...byFilter, postedWithinDays: postedCounts };
  }, [openJobs, filters]);

  const options: FilterOptions = useMemo(() => {
    // Every distinct value, plus the "not specified" marker when at least one role is
    // missing that field — offered only where it would actually match something, so the
    // dropdowns don't grow an option that finds nothing.
    const from = (pick: (job: Job) => string[]) => {
      const values = uniqueSorted(openJobs.flatMap(pick).filter(Boolean));
      const anyBlank = openJobs.some((job) => pick(job).filter(Boolean).length === 0);
      return anyBlank ? [...values, UNSPECIFIED] : values;
    };

    return {
      companies: from((j) => [j.company.name]),
      states: from((j) => [j.state]),
      types: from((j) => [j.type]),
      cities: from((j) => [j.city]),
      industries: from((j) => j.company.industries),
      companyTypes: from((j) => j.company.types),
      growthStages: from((j) => [j.company.growthStage]),
      hqCities: from((j) => [j.company.hqCity]),
      anzscos: from(occupationCodesFor),
      unitGroups: from(unitGroupCodesFor),
      oscas: from(oscaCodesFor),
      occupationLists: from(occupationListsFor),
      pathwayVisas: from(pathwayVisasFor),
      // These two carry a value for every role — 'yes', 'no' or the blank sentinel — so
      // they never need the "any blank?" pass the others do.
      sponsor: uniqueSorted(openJobs.flatMap((j) => answer(j.company.accreditedSponsor))),
      students: uniqueSorted(
        openJobs.flatMap((j) => answer(j.company.hiresInternationalStudents))
      ),
    };
  }, [openJobs]);

  // loadJobs already sorted newest first, and filtering preserves that order.
  const [companyCount, setCompanyCount] = useState(0);
  useEffect(() => {
    if (status !== 'ready' || openJobs.length > 0) return;
    let live = true;
    loadCompanies()
      .then((all) => live && setCompanyCount(all.length))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [status, openJobs.length]);

  const visible = useMemo(() => {
    const postedAfter = cutoff(filters);
    return openJobs.filter((job) => matches(job, filters, postedAfter));
  }, [openJobs, filters]);
  const activeFilters = countActiveFilters(filters);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageJobs = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const selected = visible.find((j) => j.id === selectedId) ?? visible[0] ?? null;

  /** The address bar, the tab title and the structured data all describe the same thing. */
  const reading = showDetail && route === 'jobs' ? selected : null;
  useEffect(() => {
    const origin = window.location.origin;
    const meta = metaFor(route, reading, origin);
    applyMeta(meta);
    trackPageView(meta);
    applySchema(
      reading
        ? jobPostingSchema(reading, meta.url, lapseDate(reading.posted, MONTHS_LISTED))
        : websiteSchema(origin)
    );
  }, [route, reading]);

  // Scroll the (sticky) detail panel back to the top when a different job is shown.
  useEffect(() => {
    // Optional call: jsdom (and older Safari) has no Element.scrollTo.
    detailRef.current?.scrollTo?.({ top: 0 });
  }, [selected?.id]);

  if (route !== 'jobs') {
    return (
      <div className="app" id="top">
        <Header route={route} />
        <main className={`about-panel${route === 'companies' ? ' companies-panel' : ''}`}>
          <div className="about-inner">
            {route === 'about' && <About />}
            {route === 'post' && <PostJob />}
            {route === 'companies' && <Companies />}
            {route === 'admin' && (
              <Suspense fallback={<p className="panel-note">Loading the form . . .</p>}>
                <AdminAddJob />
              </Suspense>
            )}
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className={`app${showDetail ? ' detail-open' : ''}`} id="top">
      <Header route={route} />

      <header className="page-intro">
        <h1>Jobs at Australian startups, with migration pathways and visa requirements!</h1>
      </header>

      <div className="filters-region" hidden={status === 'ready' && openJobs.length === 0}>
        <button
          type="button"
          className="filters-toggle"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((o) => !o)}
        >
          Filters
          {activeFilters > 0 && (
            <span className="filters-toggle-count">
              {activeFilters}
              <span className="visually-hidden"> active</span>
            </span>
          )}
        </button>
        {filtersOpen && (
          <Filters
            filters={filters}
            options={options}
            counts={counts}
            onChange={setFilters}
            onClear={() => setFilters(EMPTY_FILTERS)}
          />
        )}
      </div>

      <div className="workspace">
        <section className="jobs-panel" id="jobs" aria-label="Job listings" ref={listRef}>
          {status === 'ready' && openJobs.length > 0 && (
            <div className="jobs-head">
              <p className="result-count" aria-live="polite">
                {visible.length} {visible.length === 1 ? 'role' : 'roles'}
              </p>
            </div>
          )}

          {status === 'loading' && (
            <div className="job-skeletons" aria-hidden="true">
              {[0, 1, 2].map((n) => (
                <div key={n} className="job-skeleton" />
              ))}
              <p className="visually-hidden" role="status">
                Loading jobs
              </p>
            </div>
          )}
          {status === 'error' && (
            <p className="panel-note" role="alert">
              Sorry, we couldn't load the jobs right now. Please try again later.
            </p>
          )}

          {status === 'ready' &&
            (openJobs.length === 0 ? (
              <div className="panel-empty">
                <p className="panel-empty-title">No roles listed yet</p>
                <p className="panel-note">
                  In the meantime, checkout the {companyCount ? `${companyCount} ` : ''} Australian startups are
                  hiring right now!
                </p>
                <div className="panel-empty-actions">
                  <a className="btn btn-primary btn-small" href={pathFor('companies')}>
                    Browse startups hiring
                  </a>
                  <a className="btn btn-small" href={pathFor('post')}>
                    Post a role
                  </a>
                </div>
              </div>
            ) : visible.length === 0 ? (
              <div className="panel-empty">
                <p className="panel-empty-title">No roles match these filters</p>
                <p className="panel-note">Try removing one; widening a single filter usually brings roles back.</p>
                <button
                  type="button"
                  className="btn btn-primary btn-small"
                  onClick={() => setFilters(EMPTY_FILTERS)}
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <>
                <ul className="job-list">
                  {pageJobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      selected={selected?.id === job.id}
                      onSelect={openJob}
                    />
                  ))}
                </ul>

                {totalPages > 1 && (
                  <nav className="pagination" aria-label="Job pages">
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
            ))}
        </section>

        <main className="detail-panel" ref={detailRef}>
          <button type="button" className="detail-back" onClick={() => setShowDetail(false)}>
            ← Back to jobs
          </button>
          {selected ? (
            <JobDetail job={selected} />
          ) : (
            status === 'ready' && (
              openJobs.length > 0 && (
                <div className="detail-empty">
                  <h1>Find work at a Melbourne startup</h1>
                  <p>Select a role to see the details . . .</p>
                </div>
              )
            )
          )}
        </main>
      </div>

      <Footer />
    </div>
  );
}

export default App;
