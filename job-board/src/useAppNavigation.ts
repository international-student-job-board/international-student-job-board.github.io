import { RefObject, useEffect, useRef, useState } from 'react';
import { EMPTY_FILTERS } from './jobFilters';
import { filtersToParams, filtersFromParams, hasFilterParams } from './filterParams';
import { Route, parsePath, pathFor, pathFromLegacyHash } from './routes';
import { FilterState } from './components/Filters';

/** The filters the address asks for on arrival - a shared or bookmarked view. */
const filtersFromUrl = (): FilterState =>
  filtersFromParams(
    new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search),
    EMPTY_FILTERS
  );

export interface AppNavigation {
  route: Route;
  selectedId: string | null;
  showDetail: boolean;
  setShowDetail: (open: boolean) => void;
  filters: FilterState;
  setFilters: (update: FilterState | ((current: FilterState) => FilterState)) => void;
  page: number;
  setPage: (page: number) => void;
  /** Whether the reader arrived on a link that already carried filters: if so the board
   * leaves them be rather than layering an inferred home state on top. Read once, after the
   * data has loaded, to settle the initial filters - see App's own effect for that. */
  arrivedWithFilters: RefObject<boolean>;
  detailRef: RefObject<HTMLElement | null>;
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
  const arrivedWithFilters = useRef(
    typeof window !== 'undefined' && hasFilterParams(new URLSearchParams(window.location.search))
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // On mobile the list and detail are separate "pages"; this flips to the detail page when a
  // job is tapped.
  const [showDetail, setShowDetail] = useState(false);
  const [route, setRoute] = useState<Route>(() => parsePath(window.location.pathname).route);
  const [page, setPage] = useState(1);
  const detailRef = useRef<HTMLElement>(null);
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
    if (route !== 'jobs') return;
    const qs = filtersToParams(filters).toString();
    const search = qs ? `?${qs}` : '';
    if (search === window.location.search) return;
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${search}`);
  }, [filters, route, selectedId]);

  // Back to page 1 whenever the filters change.
  useEffect(() => {
    setPage(1);
  }, [filters]);

  const openJob = (id: string) => {
    setSelectedId(id);
    setShowDetail(true);
    // replaceState rather than pushState: picking through a list shouldn't bury the page you
    // arrived from under twenty back-button steps. The filter query rides along so closing
    // the role returns to the same narrowed list.
    window.history.replaceState(null, '', pathFor('jobs', id) + window.location.search);
    window.scrollTo({ top: 0 });
  };

  /** Turning a page puts you at the top of the new one. */
  const goToPage = (next: number) => {
    setPage(next);
    listRef.current?.scrollTo?.({ top: 0 });
    window.scrollTo?.({ top: 0 });
  };

  return {
    route,
    selectedId,
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
