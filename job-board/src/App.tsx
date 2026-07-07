import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { Job } from './types';
import { loadJobs } from './jobs';
import { Header } from './components/Header';
import { Filters, FilterState, FilterOptions } from './components/Filters';
import { JobCard } from './components/JobCard';
import { JobDetail } from './components/JobDetail';
import { About } from './components/About';
import { PostJob } from './components/PostJob';
import { Footer } from './components/Footer';

const PAGE_SIZE = 10;

const EMPTY_FILTERS: FilterState = {
  query: '',
  type: '',
  level: '',
  arrangement: '',
  visa: '',
  pathwayVisa: '',
  salaryMin: 0,
  skills: [],
  sponsoredOnly: false,
};

function matches(job: Job, filters: FilterState): boolean {
  if (filters.type && job.type !== filters.type) return false;
  if (filters.level && job.jobLevel !== filters.level) return false;
  if (filters.arrangement && job.arrangement !== filters.arrangement) return false;
  if (filters.visa && !job.visaEligible.includes(filters.visa)) return false;
  if (filters.pathwayVisa && !job.visaPathways.includes(filters.pathwayVisa)) return false;
  if (filters.salaryMin > 0 && job.salaryMaxAnnual < filters.salaryMin) return false;
  if (filters.sponsoredOnly && !job.employerSponsored) return false;
  if (filters.skills.length && !filters.skills.some((s) => job.skills.includes(s))) return false;

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

  const options: FilterOptions = useMemo(
    () => ({
      types: uniqueSorted(jobs.map((j) => j.type)),
      levels: uniqueSorted(jobs.map((j) => j.jobLevel)),
      arrangements: uniqueSorted(jobs.map((j) => j.arrangement)),
      visas: uniqueSorted(jobs.flatMap((j) => j.visaEligible)),
      pathwayVisas: uniqueSorted(jobs.flatMap((j) => j.visaPathways)),
      skills: uniqueSorted(jobs.flatMap((j) => j.skills)),
    }),
    [jobs]
  );

  const visible = useMemo(() => jobs.filter((job) => matches(job, filters)), [jobs, filters]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageJobs = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const selected = visible.find((j) => j.id === selectedId) ?? visible[0] ?? null;

  // Scroll the (sticky) detail panel back to the top when a different job is shown.
  useEffect(() => {
    detailRef.current?.scrollTo({ top: 0 });
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

      <div className="filters-region">
        <button
          type="button"
          className="filters-toggle"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((o) => !o)}
        >
          Filters
        </button>
        {filtersOpen && <Filters filters={filters} options={options} onChange={setFilters} />}
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

          {status === 'loading' && <p className="panel-note">Loading jobs . . .</p>}
          {status === 'error' && (
            <p className="panel-note" role="alert">
              Sorry, we couldn't load the jobs right now. Please try again later.
            </p>
          )}

          {status === 'ready' &&
            (visible.length === 0 ? (
              <p className="panel-note">No roles match your filters yet.</p>
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
                <p>
                  Select a role to see the details. Every startup here hires international
                  STEM students and graduates and can help you build a pathway to staying.
                </p>
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
