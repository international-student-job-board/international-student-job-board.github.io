import { lazy, Suspense, useEffect, useMemo, useRef } from 'react';
import './App.css';
import { useJobsData, useCompanyCount } from './useJobsData';
import { useAppNavigation } from './useAppNavigation';
import {
  EMPTY_FILTERS,
  filterOpenJobs,
  matches,
  cutoff,
  computeFacetCounts,
  computeFilterOptions,
} from './jobFilters';
import { Header } from './components/Header';
import { inferAustralianState, isLikelyAustralia } from './geo';
import { pruneToOptions } from './filterParams';
import { pathFor } from './routes';
import {
  applyMeta,
  applySchema,
  metaFor,
  jobPostingSchema,
  websiteSchema,
  validThroughFor,
} from './seo';
import { trackPageView } from './analytics';
import { Filters, countActiveFilters } from './components/Filters';
import { FiltersDisclosure } from './components/FiltersDisclosure';
import { JobCard } from './components/JobCard';
import { JobDetail } from './components/JobDetail';
import { About } from './components/About';
import { PostJob } from './components/PostJob';
import { Companies } from './components/Companies';
import { Footer } from './components/Footer';

/**
 * Split out so the admin and everything only it uses - the occupation writer, the constant
 * pickers, the tag editors - stay out of the bundle visitors download.
 */
const AdminAddJob = lazy(() =>
  import('./components/AdminAddJob').then((m) => ({ default: m.AdminAddJob }))
);

const PAGE_SIZE = 10;

export { IS_LOCAL, jobShareUrl } from './routes';

function App() {
  const { jobs, status } = useJobsData();
  const {
    route,
    selectedId,
    showDetail,
    setShowDetail,
    filters,
    setFilters,
    page,
    arrivedWithFilters,
    detailRef,
    listRef,
    openJob,
    goToPage,
  } = useAppNavigation();
  // Whether the initial filters have been settled against the loaded data yet - see the
  // effect below. Local to this one concern, so it stays here rather than in the nav hook.
  const syncedFromData = useRef(false);

  const openJobs = useMemo(() => filterOpenJobs(jobs), [jobs]);
  const counts = useMemo(() => computeFacetCounts(openJobs, filters), [openJobs, filters]);
  const options = useMemo(() => computeFilterOptions(openJobs), [openJobs]);

  /**
   * Once the data is in, settle the filters against it - one time.
   *  - arrived on a filtered link: drop any values the data can no longer offer
   *    (a company with nothing open now, a typo) so the link never sits matching
   *    nothing without saying why;
   *  - arrived clean: default the State filter to the reader's own, inferred
   *    from their time zone, when that state has roles. It's just a starting
   *    point - the chip shows it and one click clears it.
   */
  useEffect(() => {
    if (status !== 'ready' || syncedFromData.current) return;
    syncedFromData.current = true;

    setFilters((current) => {
      if (arrivedWithFilters.current) return pruneToOptions(current, options);
      if (countActiveFilters(current) > 0) return current;
      // A visitor outside Australia gets every state - narrowing to "wherever
      // Australia's time zone last resolved to" would be a guess, not a default.
      const home = isLikelyAustralia() ? inferAustralianState() : '';
      return home && options.states.includes(home) ? { ...current, states: [home] } : current;
    });
    // options is derived from the loaded jobs and stable by the time status flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // loadJobs already sorted newest first, and filtering preserves that order.
  const companyCount = useCompanyCount(status === 'ready' && openJobs.length === 0);

  const visible = useMemo(() => {
    const postedAfter = cutoff(filters);
    return openJobs.filter((job) => matches(job, filters, postedAfter));
  }, [openJobs, filters]);

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
        ? jobPostingSchema(reading, meta.url, validThroughFor(reading))
        : websiteSchema(origin)
    );
  }, [route, reading]);

  // Scroll the (sticky) detail panel back to the top when a different job is shown.
  useEffect(() => {
    // Optional call: jsdom (and older Safari) has no Element.scrollTo.
    detailRef.current?.scrollTo?.({ top: 0 });
  }, [detailRef, selected?.id]);

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
        <h1>Jobs at Australian startups, mapped with migration pathways and visa requirements!</h1>
      </header>

      <div className="filters-region" hidden={status === 'ready' && openJobs.length === 0}>
        <FiltersDisclosure activeCount={countActiveFilters(filters)}>
          <Filters
            filters={filters}
            options={options}
            counts={counts}
            resultCount={visible.length}
            onChange={setFilters}
            onClear={() => setFilters(EMPTY_FILTERS)}
          />
        </FiltersDisclosure>
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
                  In the meantime, checkout the {companyCount ? `${companyCount} ` : ''} Australian
                  startups are hiring right now!
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
                <p className="panel-note">
                  Try removing one; widening a single filter usually brings roles back.
                </p>
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
            status === 'ready' &&
            openJobs.length > 0 && (
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
