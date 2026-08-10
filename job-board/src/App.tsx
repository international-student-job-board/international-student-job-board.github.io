import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { Job } from './types';
import { loadJobs, isOpenOn } from './jobs';
import { dateValue, todayISO } from './format';
import { resolveOccupation } from './references';
import { Header } from './components/Header';
import { Filters, FilterState, FilterOptions, countActiveFilters } from './components/Filters';
import { JobCard } from './components/JobCard';
import { JobDetail } from './components/JobDetail';
import { About } from './components/About';
import { PostJob } from './components/PostJob';
import { Footer } from './components/Footer';

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
  postedWithinDays: 0,
  sponsoredOnly: false,
};

/** An empty filter narrows nothing; otherwise the job's value has to be in it. */
const allows = (selected: string[], value: string) =>
  selected.length === 0 || selected.includes(value);

/** Same, for the fields where the job itself holds a list (visas, skills). */
const overlaps = (selected: string[], values: string[]) =>
  selected.length === 0 || values.some((value) => selected.includes(value));

/**
 * `postedCutoff` is a timestamp resolved once per pass rather than per job, so
 * every card in one run is measured against the same instant; 0 means the age
 * filter is off.
 */
function matches(job: Job, filters: FilterState, postedCutoff: number): boolean {
  if (!allows(filters.types, job.type)) return false;
  if (!allows(filters.levels, job.jobLevel)) return false;
  if (!allows(filters.arrangements, job.arrangement)) return false;
  if (!overlaps(filters.visas, job.visaEligible)) return false;
  if (!overlaps(filters.pathwayVisas, job.visaPathways)) return false;
  if (!overlaps(filters.skills, job.skills)) return false;
  if (filters.salaryMin > 0 && job.salaryMaxAnnual < filters.salaryMin) return false;
  if (filters.sponsoredOnly && !job.employerSponsored) return false;

  // A role with no readable posting date can't be shown to be recent, so it
  // drops out when the reader asks for recent ones.
  if (postedCutoff > 0) {
    const posted = dateValue(job.posted);
    if (!Number.isFinite(posted) || posted < postedCutoff) return false;
  }

  if (filters.anzscos.length || filters.skillAssessments.length) {
    const occ = resolveOccupation(job.anzsco, job.skillAssessment);
    if (!allows(filters.anzscos, occ.code)) return false;
    if (!allows(filters.skillAssessments, occ.assessment)) return false;
  }

  const q = filters.query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [job.title, job.company, job.location, ...job.skills]
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

const uniqueSorted = (values: string[]) => Array.from(new Set(values)).sort();

function routeFromHash(): 'jobs' | 'post' | 'about' {
  const hash = window.location.hash;
  if (hash.startsWith('#/about')) return 'about';
  if (hash.startsWith('#/post')) return 'post';
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
  const [route, setRoute] = useState<'jobs' | 'post' | 'about'>(routeFromHash);
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

  const options: FilterOptions = useMemo(
    () => ({
      types: uniqueSorted(openJobs.map((j) => j.type)),
      levels: uniqueSorted(openJobs.map((j) => j.jobLevel)),
      arrangements: uniqueSorted(openJobs.map((j) => j.arrangement)),
      visas: uniqueSorted(openJobs.flatMap((j) => j.visaEligible)),
      pathwayVisas: uniqueSorted(openJobs.flatMap((j) => j.visaPathways)),
      anzscos: uniqueSorted(
        openJobs.map((j) => resolveOccupation(j.anzsco, j.skillAssessment).code).filter(Boolean)
      ),
      skillAssessments: uniqueSorted(
        openJobs
          .map((j) => resolveOccupation(j.anzsco, j.skillAssessment).assessment)
          .filter(Boolean)
      ),
      skills: uniqueSorted(openJobs.flatMap((j) => j.skills)),
    }),
    [openJobs]
  );

  // loadJobs already sorted newest first, and filtering preserves that order.
  const visible = useMemo(() => {
    const postedCutoff =
      filters.postedWithinDays > 0
        ? Date.now() - filters.postedWithinDays * 24 * 60 * 60 * 1000
        : 0;
    return openJobs.filter((job) => matches(job, filters, postedCutoff));
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

  if (route === 'about' || route === 'post') {
    return (
      <div className="app" id="top">
        <Header route={route} />
        <main className="about-panel">
          <div className="about-inner">{route === 'about' ? <About /> : <PostJob />}</div>
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
              <p className="result-count" aria-live="polite">
                {visible.length} {visible.length === 1 ? 'role' : 'roles'}
              </p>
            )}
          </div>
          <p className="panel-banner">
            Every role here welcomes international students &amp; graduates.
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

          {status === 'ready' &&
            (visible.length === 0 ? (
              <div className="panel-empty">
                <p className="panel-empty-title">No roles match these filters</p>
                <p className="panel-note">
                  {activeFilters > 0
                    ? 'Try widening the search filters.'
                    : 'New roles are added as startups send them in. Check back soon.'}
                </p>
                {activeFilters > 0 && (
                  <button
                    type="button"
                    className="btn btn-primary btn-small"
                    onClick={() => setFilters(EMPTY_FILTERS)}
                  >
                    Clear all filters
                  </button>
                )}
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
              <div className="detail-empty">
                <h1>Find work at a Melbourne startup</h1>
                <p>Select a role to see the details . . .</p>
              </div>
            )
          )}
        </main>
      </div>

      <Footer />
    </div>
  );
}

export default App;
