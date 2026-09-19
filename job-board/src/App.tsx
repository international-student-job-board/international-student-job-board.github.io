import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useRef } from 'react';
import './App.css';
import { useJobsData, useCompanyCount } from './useJobsData';
import { useAppNavigation, overlayView } from './useAppNavigation';
import { useIsMobile } from './useMediaQuery';
import {
  EMPTY_FILTERS,
  filterOpenJobs,
  matches,
  cutoff,
  computeFacetCounts,
  computeFilterOptions,
} from './jobFilters';
import { Header } from './components/Header';
import { CAPITAL_LOCATIONS, inferAustralianState, isLikelyAustralia } from './geo';
import { pruneToOptions, filtersToParams, withPage } from './filterParams';
import { pathFor, parsePath } from './routes';
import {
  applyMeta,
  applySchema,
  metaFor,
  jobPostingSchema,
  websiteSchema,
  landingSchema,
  validThroughFor,
} from './seo';
import {
  filtersForPath,
  pathForView,
  rememberViewOptions,
  viewHeading,
  viewLead,
  viewOf,
  viewPath,
} from './landing';
import { BrowseLinks } from './components/BrowseLinks';
import { Freshness } from './components/Freshness';
import { WhatsNew } from './components/WhatsNew';
import { trackEvent, trackFilterChange, trackPageView, trackRoleOpen } from './analytics';
import { Filters, countActiveFilters, SALARY_STEPS } from './components/Filters';
import { FiltersDisclosure } from './components/FiltersDisclosure';
import { JobCard } from './components/JobCard';
import { Pagination } from './components/Pagination';
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
  const { jobs, previewJobs, status } = useJobsData();
  const isMobile = useIsMobile();
  const {
    route,
    selectedId,
    showDetail,
    setShowDetail,
    filters,
    setFilters,
    page,
    settleLanding,
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

  /**
   * The whole board is several megabytes of CSV, so for the first moments the list is the
   * newest few days instead of a set of grey placeholders - the same roles the page's static
   * HTML already showed, so nothing appears to vanish and come back.
   *
   * Only on a clean arrival. A link with filters, a page number or one particular role in it
   * promised something specific, and answering with roles that ignore it - even for a moment -
   * is worse than a placeholder. A role that isn't in the snapshot stays a placeholder too,
   * rather than showing the wrong one until the right one loads.
   */
  // selectedId is only set in an effect, after the first render, so the address is read
  // directly for that first render - otherwise a link to a role would be treated as the plain
  // board for one frame, long enough to flash the wrong list or the wrong heading.
  const roleId = selectedId ?? parsePath(window.location.pathname).jobId;
  const previewing =
    status === 'loading' &&
    previewJobs.length > 0 &&
    page === 1 &&
    !arrivedWithFilters.current &&
    countActiveFilters(filters) === 0 &&
    (!roleId || previewJobs.some((job) => job.id === roleId));
  const previewOpen = useMemo(() => filterOpenJobs(previewJobs), [previewJobs]);
  /** What the list draws from. Filter options and counts keep reading the real board only. */
  const listJobs = previewing ? previewOpen : openJobs;
  const listReady = status === 'ready' || previewing;
  // Recomputing the facet counts and the visible list means walking every open role against
  // every filter (see computeFacetCounts) - too heavy to redo synchronously on every keystroke
  // of the search box without the input itself lagging behind what was typed. Deferring the
  // filters that feed them lets React keep the input snappy and catch the list up a moment
  // later, rather than the whole state update trailing what the reader actually typed.
  const deferredFilters = useDeferredValue(filters);
  const counts = useMemo(
    () => computeFacetCounts(openJobs, deferredFilters),
    [openJobs, deferredFilters]
  );
  const options = useMemo(() => computeFilterOptions(openJobs), [openJobs]);
  // Kept where an address can be read into filters from anywhere - the back button included.
  useEffect(() => rememberViewOptions(options), [options]);

  /**
   * Once the data is in, settle the filters against it - one time.
   *  - arrived on a filtered link: drop any values the data can no longer offer
   *    (a company with nothing open now, a typo) so the link never sits matching
   *    nothing without saying why;
   *  - arrived clean: default to the roles most worth a first look - the
   *    reader's own state (inferred from their time zone, when it has roles),
   *    accredited sponsors, companies that hire international students, and a
   *    floor on pay just high enough to screen out unpaid or junk listings.
   *    All of it is just a starting point - each shows as a chip and one click
   *    clears it.
   */
  useEffect(() => {
    if (status !== 'ready' || syncedFromData.current) return;
    syncedFromData.current = true;

    // An address like /jobs-in/melbourne is a set of filters, and needs the board's options to
    // say which ("Melbourne, Victoria"). Read here, once they exist.
    const fromPath = filtersForPath(window.location.pathname, options);
    setFilters((current) => {
      if (fromPath) return overlayView(pruneToOptions(current, options), fromPath);
      if (arrivedWithFilters.current) return pruneToOptions(current, options);
      if (countActiveFilters(current) > 0) return current;
      // A direct link to one job, with no filters of its own, should open
      // exactly that job - not silently gain default filters the sharer never
      // added, which would leave a reader elsewhere with a dead-looking link.
      if (selectedId) return current;
      // A visitor outside Australia gets every place - narrowing to "wherever
      // Australia's time zone last resolved to" would be a guess, not a default.
      // The time zone names a state; its capital is where most of that state's roles are.
      const home = isLikelyAustralia() ? (CAPITAL_LOCATIONS[inferAustralianState()] ?? '') : '';
      return {
        ...current,
        ...(home && options.jobLocations.includes(home) ? { jobLocations: [home] } : {}),
        ...(options.sponsor.includes('yes') ? { sponsor: ['yes'] } : {}),
        ...(options.students.includes('yes') ? { students: ['yes'] } : {}),
        salaryMin: SALARY_STEPS[0],
      };
    });
    settleLanding();
    // options is derived from the loaded jobs and stable by the time status flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // loadJobs already sorted newest first, and filtering preserves that order.
  const companyCount = useCompanyCount(status === 'ready' && openJobs.length === 0);

  const visible = useMemo(() => {
    const postedAfter = cutoff(deferredFilters);
    return listJobs.filter((job) => matches(job, deferredFilters, postedAfter));
  }, [listJobs, deferredFilters]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageJobs = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const selected = visible.find((j) => j.id === selectedId) ?? visible[0] ?? null;

  /** "N new roles in the last 24 hours" clicked: the board narrowed to just those. */
  const showRecent = (days: number) => {
    setFilters({ ...EMPTY_FILTERS, postedWithinDays: days });
    listRef.current?.scrollIntoView?.({ block: 'start' });
  };

  /** The address of a page of this same list - same filters, same role open, the page swapped. */
  const hrefForPage = (n: number) => {
    // On a landing page the path already says every filter, so only the page goes in the query.
    const landing = roleId ? null : viewOf(filters);
    const target = landing ? pathForView(landing) : null;
    const query = withPage(target ? new URLSearchParams() : filtersToParams(filters), n).toString();
    return `${target ?? window.location.pathname}${query ? `?${query}` : ''}`;
  };

  /** The address bar, the tab title and the structured data all describe the same thing. */
  const reading = showDetail && route === 'jobs' ? selected : null;
  // A string, not the view: the view is rebuilt on every render, and this is an effect's dependency.
  const view = route === 'jobs' && !roleId ? viewOf(filters) : null;
  const landingPath = view ? viewPath(view) : null;
  const landingHeading = view ? viewHeading(view) : '';
  useEffect(() => {
    const origin = window.location.origin;
    const meta = metaFor(
      route,
      reading,
      origin,
      landingPath ? { path: landingPath, heading: landingHeading } : null
    );
    applyMeta(meta);
    trackPageView(meta);
    applySchema(
      reading
        ? jobPostingSchema(reading, meta.url, validThroughFor(reading))
        : landingPath
          ? landingSchema(meta, landingHeading, origin)
          : websiteSchema(origin)
    );
  }, [route, reading, landingPath, landingHeading]);

  // What people search for, reported once they stop typing rather than on every keystroke.
  // Whether it found anything is what makes the log useful: a term with no results is a role or
  // employer people wanted and the board doesn't have.
  const searched = filters.query.trim();
  const found = useRef(0);
  found.current = visible.length;
  useEffect(() => {
    if (!searched) return;
    const timer = window.setTimeout(
      () =>
        trackEvent('search', {
          search_term: searched.slice(0, 80),
          has_results: found.current > 0 ? 'yes' : 'no',
        }),
      1200
    );
    return () => window.clearTimeout(timer);
  }, [searched]);

  // Scroll the (sticky) detail panel back to the top when a different job is shown.
  useEffect(() => {
    // Optional call: jsdom (and older Safari) has no Element.scrollTo.
    detailRef.current?.scrollTo?.({ top: 0 });
  }, [detailRef, selected?.id]);

  if (route !== 'jobs') {
    // The companies page is a listing like the board, so it gets the board's frame - the
    // intro, the filter bar and the results band at full width. The rest are pages to read,
    // and stay in a padded column.
    if (route === 'companies') {
      return (
        <div className="app" id="top">
          <Header route={route} />
          <main className="listing-page">
            <Companies />
          </main>
          <Footer />
        </div>
      );
    }

    return (
      <div className="app" id="top">
        <Header route={route} />
        <main className="about-panel">
          <div className="about-inner">
            {route === 'about' && <About />}
            {route === 'post' && <PostJob />}
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

      {/* The board's headline, its one-line description and what's new belong to the board. On a
          role's own address the role is the page - its title is the <h1> - so none of it is
          shown above it. */}
      {!roleId && (
        <header className="page-intro page-intro-home">
          <h1 className="page-intro-title">
            {view ? landingHeading : 'Startup jobs in Australia for international students'}
          </h1>
          {/* On a landing page the lead says what this view holds, in real numbers - the same
              sentence the page's static HTML opens with. */}
          <p className="page-lead">
            {view && status === 'ready'
              ? viewLead(view, visible.length, new Set(visible.map((job) => job.company.name)).size)
              : "Jobs sourced from each state's open-sourced database of startups and scaleups, mapped with visa pathways, occupation types and skill assessments."}
          </p>
          {/* That the board is live, and whether anything changed since the reader was last here.
              Not on a landing page, where the heading is already about something specific. */}
          {!view && (
            <div className="intro-status">
              {status === 'ready' && <Freshness jobs={openJobs} onShow={showRecent} />}
              <WhatsNew />
            </div>
          )}
        </header>
      )}

      <div className="filters-region" hidden={status === 'ready' && openJobs.length === 0}>
        {/* Open where there is room for it beside the list. On a phone it is closed: open, the
            filter controls fill the whole first screen and no role appears until the reader
            scrolls past them - the secondary controls outranking the thing they came for. */}
        <FiltersDisclosure activeCount={countActiveFilters(filters)} defaultOpen={!isMobile}>
          <Filters
            filters={filters}
            options={options}
            counts={counts}
            resultCount={visible.length}
            onChange={(next) => {
              trackFilterChange(filters, next);
              setFilters(next);
            }}
            onClear={() => {
              trackEvent('filter_clear', { active: countActiveFilters(filters) });
              setFilters(EMPTY_FILTERS);
            }}
          />
        </FiltersDisclosure>
      </div>

      <div className="workspace">
        <section className="jobs-panel" id="jobs" aria-label="Job listings" ref={listRef}>
          {listReady && listJobs.length > 0 && (
            <div className="jobs-head">
              <p className="result-count" aria-live="polite">
                {previewing
                  ? `The newest ${visible.length.toLocaleString('en-AU')} roles, while the full board loads`
                  : `${visible.length.toLocaleString('en-AU')} ${visible.length === 1 ? 'role' : 'roles'}`}
              </p>
            </div>
          )}

          {status === 'loading' && !previewing && (
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

          {listReady &&
            (listJobs.length === 0 ? (
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
                      onSelect={(id) => {
                        const job = visible.find((j) => j.id === id);
                        if (job) trackRoleOpen(job);
                        openJob(id);
                      }}
                    />
                  ))}
                </ul>

                <Pagination
                  page={currentPage}
                  totalPages={totalPages}
                  label="Job pages"
                  hrefFor={hrefForPage}
                  onPage={goToPage}
                />
              </>
            ))}
        </section>

        <main className="detail-panel">
          <div className="detail-scroll" ref={detailRef}>
            <button type="button" className="detail-back" onClick={() => setShowDetail(false)}>
              ← Back to jobs
            </button>
            {selected ? (
              <JobDetail job={selected} titleLevel={roleId ? 1 : 2} />
            ) : (
              listReady &&
              listJobs.length > 0 && (
                <div className="detail-empty">
                  <h2>Find work at an Australian startup</h2>
                  <p>Select a role to see the details . . .</p>
                </div>
              )
            )}
          </div>
        </main>
      </div>

      {status === 'ready' && <BrowseLinks jobs={openJobs} />}

      <Footer />
    </div>
  );
}

export default App;
