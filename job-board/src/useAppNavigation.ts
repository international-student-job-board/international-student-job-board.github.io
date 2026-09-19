import { RefObject, useEffect, useRef, useState } from 'react';
import { EMPTY_FILTERS } from './jobFilters';
import {
  filtersToParams,
  filtersFromParams,
  hasFilterParams,
  pageFromParams,
  withPage,
  PAGE_PARAM,
} from './filterParams';
import { Route, parsePath, pathFor, pathFromLegacyHash } from './routes';
import { FilterState } from './components/Filters';
import { filtersForPath, isLandingPath, pathForView, viewOf } from './landing';

/** The page the address asks for on arrival. */
const pageFromUrl = (): number =>
  pageFromParams(new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search));

/** Whether the layout has stacked the list and the role into one column - see the 900px rule in App.css. */
const isStacked = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 900px)').matches;

/** The filters the address asks for on arrival - a shared or bookmarked view. */
const filtersFromUrl = (): FilterState => {
  const fromQuery = filtersFromParams(
    new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search),
    EMPTY_FILTERS
  );
  // A landing address (/jobs-in/melbourne) is filters too, written as a path. Known only once the
  // board has loaded; until then App reads it once the options exist.
  const fromPath = typeof window === 'undefined' ? null : filtersForPath(window.location.pathname);
  return fromPath ? overlayView(fromQuery, fromPath) : fromQuery;
};

/** `filters` with the three a landing address sets - place, kind of work, sponsors - taken from
 * `view` wherever it names one; everything else the query asked for stays. */
export function overlayView(filters: FilterState, view: FilterState): FilterState {
  return {
    ...filters,
    jobLocations: view.jobLocations.length ? view.jobLocations : filters.jobLocations,
    types: view.types.length ? view.types : filters.types,
    sponsor: view.sponsor.length ? view.sponsor : filters.sponsor,
    jobLevels: view.jobLevels.length ? view.jobLevels : filters.jobLevels,
  };
}

export interface AppNavigation {
  route: Route;
  selectedId: string | null;
  showDetail: boolean;
  setShowDetail: (open: boolean) => void;
  filters: FilterState;
  setFilters: (update: FilterState | ((current: FilterState) => FilterState)) => void;
  page: number;
  setPage: (page: number) => void;
  /** The city the board started on by default (from the reader's time zone), or ''. See viewOf. */
  homeDefault: string;
  setHomeDefault: (location: string) => void;
  /** Whether the address is a landing page's and its filters are still to be read from it - true
   * until App has the board's options to resolve it with, so the address isn't rewritten to
   * something else in the meantime. */
  landingPending: boolean;
  settleLanding: () => void;
  /** Whether the reader arrived on a link that already carried filters: if so the board
   * leaves them be rather than layering an inferred home state on top. Read once, after the
   * data has loaded, to settle the initial filters - see App's own effect for that. */
  arrivedWithFilters: RefObject<boolean>;
  detailRef: RefObject<HTMLDivElement | null>;
  listRef: RefObject<HTMLElement | null>;
  openJob: (id: string) => void;
  goToPage: (next: number) => void;
}

/**
 * The address bar as the single source of truth for what's on screen - which route, which
 * role, which filters - read on arrival and on every back/forward step, and kept in sync as
 * the reader clicks around. Everything here is about the browser/URL integration; the
 * business rules for *which* roles a filter set matches live in `jobFilters.ts`.
 */
export function useAppNavigation(): AppNavigation {
  const [filters, setFilters] = useState<FilterState>(filtersFromUrl);
  // A link to page 3 is as specific as a link with filters: it names a view, so the board
  // doesn't swap in its default filters underneath it.
  const arrivedWithFilters = useRef(
    typeof window !== 'undefined' &&
      (hasFilterParams(new URLSearchParams(window.location.search)) ||
        new URLSearchParams(window.location.search).has(PAGE_PARAM) ||
        isLandingPath(window.location.pathname))
  );
  const [landingPending, setLandingPending] = useState(
    () => typeof window !== 'undefined' && isLandingPath(window.location.pathname)
  );
  const [homeDefault, setHomeDefault] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // On mobile the list and detail are separate "pages"; this flips to the detail page when a
  // job is tapped.
  const [showDetail, setShowDetail] = useState(false);
  const [route, setRoute] = useState<Route>(() => parsePath(window.location.pathname).route);
  const [page, setPage] = useState(pageFromUrl);
  const detailRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLElement>(null);

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

    // Back/forward can land on a different set of filters (they live in the query string),
    // so a history step re-reads them; in-app navigation keeps the filters it already has.
    // The companies page keeps its own query params under some of the same names, so only
    // re-read while the board is showing.
    const onPopState = () => {
      read();
      if (parsePath(window.location.pathname).route === 'jobs') {
        setFilters(filtersFromUrl());
        setPage(pageFromUrl());
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
        const leavingLanding = isLandingPath(window.location.pathname);
        window.history.pushState(null, '', url.pathname);
        window.scrollTo({ top: 0 });
        // A link to a landing page is a link to a set of filters, so following one sets them
        // (and starts at page 1); any other link keeps the filters the reader has.
        const view = filtersForPath(url.pathname);
        if (view) {
          setFilters(view);
          setPage(1);
        } else if (leavingLanding && url.pathname === pathFor('jobs')) {
          // "All roles" from a landing page means all of them, not the city it was showing.
          setFilters(EMPTY_FILTERS);
          setPage(1);
        }
      }
      read();
    };

    read();
    window.addEventListener('popstate', onPopState);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('popstate', onPopState);
      document.removeEventListener('click', onClick);
    };
  }, []);

  /**
   * The filters live in the query string so a narrowed board can be bookmarked or shared.
   * Every change rewrites it in place (no new history entry per keystroke); the path itself
   * - which role is open - is left untouched.
   */
  useEffect(() => {
    if (route !== 'jobs' || landingPending) return;
    // The address says everything the filters do, so it is written as the shortest thing that
    // does. A role open: its own path, the filters in the query. No role, and the filters are
    // exactly a landing view (one city, one kind of work, sponsors): that view's own path, and
    // nothing in the query but the page. Anything else: the board, the filters in the query.
    const { jobId } = parsePath(window.location.pathname);
    const view = jobId ? null : viewOf(filters, homeDefault);
    const landingPath = view ? pathForView(view) : null;
    const pathname = jobId ? window.location.pathname : (landingPath ?? pathFor('jobs'));
    const qs = withPage(
      landingPath ? new URLSearchParams() : filtersToParams(filters),
      page
    ).toString();
    const search = qs ? `?${qs}` : '';
    if (search === window.location.search && pathname === window.location.pathname) return;
    window.history.replaceState(window.history.state, '', `${pathname}${search}`);
  }, [filters, page, route, selectedId, landingPending, homeDefault]);

  // The default city stops being one as soon as the reader changes the location filter - picking
  // the same city again after that is a choice, and a landing page.
  useEffect(() => {
    if (homeDefault && filters.jobLocations.join('|') !== homeDefault) setHomeDefault('');
  }, [filters.jobLocations, homeDefault]);

  // Back to page 1 whenever the filters change. Compared by what they say, not by identity: the
  // board rebuilds the filter object when it settles them against the data, and a link to page
  // 3 must survive that - nothing about the view actually changed.
  const filtersKey = filtersToParams(filters).toString();
  const seenFilters = useRef(filtersKey);
  useEffect(() => {
    if (seenFilters.current === filtersKey) return;
    seenFilters.current = filtersKey;
    setPage(1);
  }, [filtersKey]);

  const openJob = (id: string) => {
    setSelectedId(id);
    setShowDetail(true);
    // replaceState rather than pushState: picking through a list shouldn't bury the page you
    // arrived from under twenty back-button steps. The filter query rides along so closing
    // the role returns to the same narrowed list.
    window.history.replaceState(null, '', pathFor('jobs', id) + window.location.search);
    // Only where the role replaces the list. Beside it, the role is pinned in view and the
    // list keeps its place, so jumping to the top would throw away where you were reading.
    if (isStacked()) window.scrollTo({ top: 0 });
  };

  /**
   * Turning a page puts you at the top of the new list - the top of the list, not of the
   * page, so the intro and filters you already scrolled past don't come back between pages.
   * (.jobs-panel carries the scroll-margin that keeps it clear of the sticky header.)
   */
  const goToPage = (next: number) => {
    setPage(next);
    listRef.current?.scrollIntoView?.({ block: 'start' });
  };

  return {
    route,
    selectedId,
    landingPending,
    settleLanding: () => setLandingPending(false),
    homeDefault,
    setHomeDefault,
    showDetail,
    setShowDetail,
    filters,
    setFilters,
    page,
    setPage,
    arrivedWithFilters,
    detailRef,
    listRef,
    openJob,
    goToPage,
  };
}
