import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { Job, jobLocation } from './types';
import { loadJobs, isRecent } from './jobs';
import { loadCompanies } from './companies';
import { dateValue, todayISO } from './format';
import { pathwayVisasFor, occupationCodesFor } from './references';
import { Header } from './components/Header';
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
 * Split out so the admin and everything only it uses — the occupation writer,
 * the constant pickers, the tag editors — stay out of the bundle visitors
 * download. The route is unreachable outside a dev build, so the chunk is
 * never requested there.
 */
const AdminAddJob = lazy(() =>
  import('./components/AdminAddJob').then((m) => ({ default: m.AdminAddJob }))
);

const PAGE_SIZE = 10;

const EMPTY_FILTERS: FilterState = {
  query: '',
  companies: [],
  types: [],
  cities: [],
  industries: [],
  companyTypes: [],
  growthStages: [],
  hqCities: [],
  anzscos: [],
  pathwayVisas: [],
  sponsor: [],
  students: [],
  postedWithinDays: 0,
};

/**
 * The value a filter uses to mean "roles that don't say". An empty string is
 * the natural sentinel: it is exactly what a job carries when the field is
 * blank, so single-value fields need no special case at all.
 */
export const UNSPECIFIED = '';

/** An empty filter narrows nothing; otherwise the job's value has to be in it. */
const allows = (selected: string[], value: string) =>
  selected.length === 0 || selected.includes(value.trim());

/**
 * Same, for the fields where the job itself holds a list (occupations, visas).
 * A role with an empty list matches only when "Not specified" is what was asked
 * for — otherwise a blank field would quietly satisfy every filter.
 */
const overlaps = (selected: string[], values: string[]) =>
  selected.length === 0 ||
  (values.length
    ? values.some((value) => selected.includes(value))
    : selected.includes(UNSPECIFIED));

/**
 * A hand-checked yes/no/nobody-said column as a filter value.
 *
 * The blank case is the same UNSPECIFIED sentinel every other filter uses, so
 * these two need no special handling anywhere downstream — they are ordinary
 * list filters whose values happen to come from a boolean.
 */
const answer = (value: boolean | undefined): string[] => [
  value === true ? 'yes' : value === false ? 'no' : UNSPECIFIED,
];

/**
 * `postedAfter` is a timestamp resolved once per pass rather than per job, so
 * every card in one run is measured against the same instant. 0 means the
 * recency filter is off.
 */
function matches(job: Job, filters: FilterState, postedAfter: number): boolean {
  if (!allows(filters.companies, job.company.name)) return false;
  if (!allows(filters.types, job.type)) return false;
  if (!allows(filters.cities, job.city)) return false;
  if (!overlaps(filters.industries, job.company.industries)) return false;
  if (!overlaps(filters.companyTypes, job.company.types)) return false;
  if (!allows(filters.growthStages, job.company.growthStage)) return false;
  if (!allows(filters.hqCities, job.company.hqCity)) return false;
  // A role can map to several occupations, so it matches if any of them do.
  if (!overlaps(filters.anzscos, occupationCodesFor(job))) return false;
  // The occupations' own visas are what the detail page shows as pathways, so
  // filtering reads the same function — a role can always be found by the
  // visas it is shown to offer.
  if (!overlaps(filters.pathwayVisas, pathwayVisasFor(job))) return false;
  if (!overlaps(filters.sponsor, answer(job.company.accreditedSponsor))) return false;
  if (!overlaps(filters.students, answer(job.company.hiresInternationalStudents))) return false;

  // A role we can't date can't be shown to be recent, so it drops out when the
  // reader asks for recent ones.
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

type Route = 'jobs' | 'companies' | 'post' | 'about' | 'admin';

/** The admin route exists only in a local dev build. */
export const IS_LOCAL = process.env.NODE_ENV === 'development';

function routeFromHash(): Route {
  const hash = window.location.hash;
  if (hash.startsWith('#/about')) return 'about';
  if (hash.startsWith('#/post')) return 'post';
  if (hash.startsWith('#/companies')) return 'companies';
  if (hash.startsWith('#/admin') && IS_LOCAL) return 'admin';
  return 'jobs';
}

/**
 * The job id in the address bar, if there is one: #/jobs/7.
 *
 * Which role you are reading used to be state and nothing else, so every job on
 * the board shared one address and there was nothing to send anyone. It lives
 * in the URL now, which makes it linkable, bookmarkable, and undoable with the
 * back button.
 */
function jobIdFromHash(): string | null {
  return window.location.hash.match(/^#\/jobs\/([^/?#]+)/)?.[1] ?? null;
}

/** The address for one role, absolute so it can be pasted anywhere. */
export function jobShareUrl(id: string): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#/jobs/${encodeURIComponent(id)}`;
}

function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // On mobile the list and detail are separate "pages"; this flips to the
  // detail page when a job is tapped. On desktop both always show side by side.
  const [showDetail, setShowDetail] = useState(false);
  const [route, setRoute] = useState<Route>(routeFromHash);
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const detailRef = useRef<HTMLElement>(null);

  useEffect(() => {
    loadJobs()
      .then((data) => {
        setJobs(data);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      setRoute(routeFromHash());
      // Covers the back button and a pasted link alike.
      const shared = jobIdFromHash();
      if (shared) {
        setSelectedId(shared);
        setShowDetail(true);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // A link opened cold: the id is in the address before the jobs have loaded.
  useEffect(() => {
    const shared = jobIdFromHash();
    if (shared) {
      setSelectedId(shared);
      setShowDetail(true);
    }
  }, []);

  // Leaving the jobs page (or switching routes) drops back to the list view.
  useEffect(() => {
    setShowDetail(false);
  }, [route]);

  const openJob = (id: string) => {
    setSelectedId(id);
    setShowDetail(true);
    // replaceState rather than assigning the hash: picking through a list
    // shouldn't bury the page you arrived from under twenty back-button steps.
    window.history.replaceState(null, '', `#/jobs/${encodeURIComponent(id)}`);
    window.scrollTo({ top: 0 });
  };

  // Back to page 1 whenever the filters change.
  useEffect(() => {
    setPage(1);
  }, [filters]);

  // Stale roles are dropped here rather than inside the filtering, so they are
  // gone from everything downstream: the count, the default selection, and the
  // filter dropdowns — which would otherwise offer a company or an occupation
  // that no listed role has. Measured against the viewer's own date, so the
  // board ages as it is read rather than as of whenever it was built.
  const openJobs = useMemo(() => {
    const today = todayISO();
    return jobs.filter((job) => isRecent(job, today));
  }, [jobs]);

  /**
   * How many roles each option would leave, counted against everything the
   * *other* filters allow — not against the whole board and not against the
   * current results.
   *
   * Counting against the whole board would promise matches that the filters
   * already rule out. Counting against the current results would show a zero
   * beside every unpicked value in a filter you have already used, because
   * that filter has just excluded them all. Excluding the filter from its own
   * count is the only version that answers the question being asked: "what
   * happens if I tick this."
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
      types: (j) => [j.type],
      cities: (j) => [j.city],
      industries: (j) => j.company.industries,
      companyTypes: (j) => j.company.types,
      growthStages: (j) => [j.company.growthStage],
      hqCities: (j) => [j.company.hqCity],
      anzscos: occupationCodesFor,
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
     * The recency filter can't be tallied by walking a job's values, because
     * its options are thresholds rather than things a job "has". Each window is
     * counted by running the filter as if it were picked, with the current
     * choice lifted.
     */
    const postedCounts = new Map<string, number>();
    ['1', '2', '7', '14', '30', '60'].forEach((value) => {
      const asked = { ...filters, postedWithinDays: Number(value) };
      postedCounts.set(value, openJobs.filter((job) => matches(job, asked, cutoff(asked))).length);
    });

    return { ...byFilter, postedWithinDays: postedCounts };
  }, [openJobs, filters]);

  const options: FilterOptions = useMemo(() => {
    // Every distinct value, plus the "not specified" marker when at least one
    // role is missing that field — offered only where it would actually match
    // something, so the dropdowns don't grow an option that finds nothing.
    const from = (pick: (job: Job) => string[]) => {
      const values = uniqueSorted(openJobs.flatMap(pick).filter(Boolean));
      const anyBlank = openJobs.some((job) => pick(job).filter(Boolean).length === 0);
      return anyBlank ? [...values, UNSPECIFIED] : values;
    };

    return {
      companies: from((j) => [j.company.name]),
      types: from((j) => [j.type]),
      cities: from((j) => [j.city]),
      industries: from((j) => j.company.industries),
      companyTypes: from((j) => j.company.types),
      growthStages: from((j) => [j.company.growthStage]),
      hqCities: from((j) => [j.company.hqCity]),
      anzscos: from(occupationCodesFor),
      pathwayVisas: from(pathwayVisasFor),
      // These two carry a value for every role — 'yes', 'no' or the blank
      // sentinel — so they never need the "any blank?" pass the others do.
      sponsor: uniqueSorted(openJobs.flatMap((j) => answer(j.company.accreditedSponsor))),
      students: uniqueSorted(
        openJobs.flatMap((j) => answer(j.company.hiresInternationalStudents))
      ),
    };
  }, [openJobs]);

  // loadJobs already sorted newest first, and filtering preserves that order.
  // Only fetched when the board is empty, and only to make the empty state say
  // something true and specific: "397 startups are hiring" is a reason to click
  // through, "check back soon" is not.
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

      {/* No point offering filters over an empty board — supporting UI that
          can't do anything yet is just noise in front of the real message. */}
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
        <section className="jobs-panel" id="jobs" aria-label="Job listings">
          <div className="jobs-head">
            <h1 className="panel-title">Jobs</h1>
            {status === 'ready' && (
              openJobs.length > 0 && (
                <p className="result-count" aria-live="polite">
                  {visible.length} {visible.length === 1 ? 'role' : 'roles'}
                </p>
              )
            )}
          </div>
          <p className="panel-banner">
            We're working through this list manually to confirm which startups sponsor visas and which hire international students and graduates.
          </p>

          {/* Placeholder cards rather than a line of text: the list keeps its
              shape while it loads, so nothing jumps when the jobs arrive. */}
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

          {/* An empty board and an over-narrowed search are different problems
              and get different words. Saying "no roles match these filters"
              when no filters are set sends someone hunting for a control to
              undo, and there isn't one. */}
          {status === 'ready' &&
            (openJobs.length === 0 ? (
              <div className="panel-empty">
                <p className="panel-empty-title">No roles listed yet</p>
                <p className="panel-note">
                  We're checking roles by hand before they go up: reading the ad, matching the
                  occupation and working out the visa pathways. The first ones land here shortly.
                </p>
                <p className="panel-note">
                  In the meantime, {companyCount ? `${companyCount} ` : ''}Melbourne startups are
                  hiring right now, and you can go to them directly.
                </p>
                <div className="panel-empty-actions">
                  <a className="btn btn-primary btn-small" href="#/companies">
                    Browse startups hiring
                  </a>
                  <a className="btn btn-small" href="#/post">
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
                      onClick={() => setPage(currentPage - 1)}
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
                      onClick={() => setPage(currentPage + 1)}
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
