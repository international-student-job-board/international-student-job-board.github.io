import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { Job } from './types';
import { loadJobs, isOpenOn } from './jobs';
import { loadCompanies } from './companies';
import { dateValue, todayISO, isStartAsap } from './format';
import {
  pathwayVisasFor,
  occupationCodesFor,
  assessmentsFor,
} from './references';
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
  types: [],
  levels: [],
  arrangements: [],
  visas: [],
  pathwayVisas: [],
  anzscos: [],
  skillAssessments: [],
  skills: [],
  salaryMin: 0,
  startsWithinDays: 0,
  postedWithinDays: 0,
  sponsorship: [],
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
 * Same, for the fields where the job itself holds a list (visas, skills). A
 * role with an empty list matches only when "Not specified" is what was asked
 * for — otherwise a blank field would quietly satisfy every filter.
 */
const overlaps = (selected: string[], values: string[]) =>
  selected.length === 0 ||
  (values.length
    ? values.some((value) => selected.includes(value))
    : selected.includes(UNSPECIFIED));

/**
 * Both cutoffs are timestamps resolved once per pass rather than per job, so
 * every card in one run is measured against the same instant.
 *
 * `startsBy`: 0 means the start-date filter is off, and -1 means "roles with no
 * start date given". `postedAfter`: 0 means the recency filter is off.
 */
interface DateCutoffs {
  startsBy: number;
  postedAfter: number;
}

function matches(job: Job, filters: FilterState, dates: DateCutoffs): boolean {
  if (!allows(filters.types, job.type)) return false;
  if (!allows(filters.levels, job.jobLevel)) return false;
  if (!overlaps(filters.arrangements, job.arrangements)) return false;
  if (!overlaps(filters.visas, job.visaEligible)) return false;
  // The occupation's own visas count as pathways too, exactly as the detail
  // page shows them — filtering has to match what the reader was told.
  if (!overlaps(filters.pathwayVisas, pathwayVisasFor(job))) return false;
  if (!overlaps(filters.skills, job.skills)) return false;
  // A negative threshold is the "Not specified" band: roles whose salary we
  // couldn't read a number from at all.
  if (filters.salaryMin < 0 && job.salaryMaxAnnual > 0) return false;
  if (filters.salaryMin > 0 && job.salaryMaxAnnual < filters.salaryMin) return false;
  // '' is the answer for a role that never said, so a blank field matches
  // "Not specified" and nothing else.
  if (filters.sponsorship.length) {
    const answer =
      job.employerSponsored === true ? 'yes' : job.employerSponsored === false ? 'no' : '';
    if (!filters.sponsorship.includes(answer)) return false;
  }

  // A role we can't date can't be shown to be recent, so it drops out when the
  // reader asks for recent ones.
  if (dates.postedAfter > 0) {
    const posted = dateValue(job.posted);
    if (!Number.isFinite(posted) || posted < dates.postedAfter) return false;
  }

  // A role already under way counts as starting within any window: it is
  // available now, which is the question the filter is really asking. A role
  // starting as soon as someone is found is the same answer, stated instead of
  // dated — so it belongs in every window, and not under "not specified".
  const { startsBy } = dates;
  if (startsBy !== 0) {
    const asap = isStartAsap(job.startDate);
    const starts = dateValue(job.startDate);
    const known = asap || Number.isFinite(starts);
    if (startsBy < 0) {
      if (known) return false;
    } else if (!known || (!asap && starts > startsBy)) {
      return false;
    }
  }

  // A role can map to several occupations, so it matches if any of them do.
  if (filters.anzscos.length && !overlaps(filters.anzscos, occupationCodesFor(job))) {
    return false;
  }
  if (
    filters.skillAssessments.length &&
    !overlaps(filters.skillAssessments, assessmentsFor(job))
  ) {
    return false;
  }

  const q = filters.query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [job.title, job.company, job.location, ...job.skills]
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The two date filters, resolved to instants for one filtering pass. */
const cutoffs = (filters: FilterState): DateCutoffs => ({
  startsBy:
    filters.startsWithinDays > 0
      ? Date.now() + filters.startsWithinDays * DAY_MS
      : filters.startsWithinDays,
  postedAfter:
    filters.postedWithinDays > 0 ? Date.now() - filters.postedWithinDays * DAY_MS : 0,
});

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
    const onHashChange = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Leaving the jobs page (or switching routes) drops back to the list view.
  useEffect(() => {
    setShowDetail(false);
  }, [route]);

  const openJob = (id: string) => {
    setSelectedId(id);
    setShowDetail(true);
    window.scrollTo({ top: 0 });
  };

  // Back to page 1 whenever the filters change.
  useEffect(() => {
    setPage(1);
  }, [filters]);

  // Closed roles are dropped here rather than inside the filtering, so they are
  // gone from everything downstream: the count, the default selection, and the
  // filter dropdowns — which would otherwise offer a skill or a visa that no
  // listed role has. Evaluated against the viewer's own date.
  const openJobs = useMemo(() => {
    const today = todayISO();
    return jobs.filter((job) => isOpenOn(job, today));
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
    const dates = cutoffs(filters);
    const without = (key: FilterListKey) =>
      openJobs.filter((job) => matches(job, { ...filters, [key]: [] }, dates));

    const tally = (jobs: Job[], pick: (job: Job) => string[]) => {
      const counted = new Map<string, number>();
      jobs.forEach((job) => {
        const values = pick(job).filter(Boolean);
        const keys = values.length ? Array.from(new Set(values)) : [UNSPECIFIED];
        keys.forEach((key) => counted.set(key, (counted.get(key) ?? 0) + 1));
      });
      return counted;
    };

    const sponsorshipOf = (job: Job) => [
      job.employerSponsored === true ? 'yes' : job.employerSponsored === false ? 'no' : '',
    ];

    const pickers: Record<FilterListKey, (job: Job) => string[]> = {
      types: (j) => [j.type],
      levels: (j) => [j.jobLevel],
      arrangements: (j) => j.arrangements,
      visas: (j) => j.visaEligible,
      pathwayVisas: pathwayVisasFor,
      anzscos: occupationCodesFor,
      skillAssessments: assessmentsFor,
      skills: (j) => j.skills,
    };

    const byFilter = Object.fromEntries(
      (Object.keys(pickers) as FilterListKey[]).map((key) => [
        key,
        tally(without(key), pickers[key]),
      ])
    ) as Record<FilterListKey, Map<string, number>>;

    // Sponsorship isn't one of the list filters, so it counts on its own — with
    // its own selection lifted, like the rest.
    const forSponsorship = openJobs.filter((job) =>
      matches(job, { ...filters, sponsorship: [] }, dates)
    );

    /**
     * The single-choice filters — salary and the two date windows — can't be
     * tallied by walking a job's values, because their options are thresholds
     * rather than things a job "has". Each option is counted by running the
     * filter as if it were picked, with its own current choice lifted.
     */
    const countThresholds = (key: 'salaryMin' | 'postedWithinDays' | 'startsWithinDays', values: string[]) => {
      const counted = new Map<string, number>();
      values.forEach((value) => {
        const asked = { ...filters, [key]: Number(value) };
        counted.set(
          value,
          openJobs.filter((job) => matches(job, asked, cutoffs(asked))).length
        );
      });
      return counted;
    };

    return {
      ...byFilter,
      sponsorship: tally(forSponsorship, sponsorshipOf),
      salaryMin: countThresholds('salaryMin', ['40000', '60000', '80000', '100000', '-1']),
      postedWithinDays: countThresholds('postedWithinDays', ['1', '2', '7', '14', '30', '60']),
      startsWithinDays: countThresholds('startsWithinDays', ['30', '90', '180', '-1']),
    };
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
      types: from((j) => [j.type]),
      levels: from((j) => [j.jobLevel]),
      arrangements: from((j) => j.arrangements),
      visas: from((j) => j.visaEligible),
      pathwayVisas: from(pathwayVisasFor),
      anzscos: from(occupationCodesFor),
      skillAssessments: from(assessmentsFor),
      skills: from((j) => j.skills),
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
    return openJobs.filter((job) => matches(job, filters, cutoffs(filters)));
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
            Curated startup roles that welcome international students and graduates.
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
