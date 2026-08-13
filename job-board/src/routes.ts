// Real URLs, not fragments.

export type Route = 'jobs' | 'companies' | 'post' | 'about' | 'admin';

/** The admin route exists only in a local dev build. */
export const IS_LOCAL = process.env.NODE_ENV === 'development';

/** Where the site is served from — "/" for a user site, "/repo/" otherwise. */
export const BASE = (process.env.PUBLIC_URL || '').replace(/\/$/, '');

export interface Location {
  route: Route;
  /** The role being read, when the path names one. */
  jobId: string | null;
}

/** The path with the base stripped, so the parser sees "/jobs/7" either way. */
function relative(pathname: string): string {
  const path = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname;
  return path.startsWith('/') ? path : `/${path}`;
}

export function parsePath(pathname: string): Location {
  const path = relative(pathname).replace(/\/+$/, '') || '/';
  const [, first, second] = path.split('/');

  if (first === 'about') return { route: 'about', jobId: null };
  if (first === 'post') return { route: 'post', jobId: null };
  if (first === 'companies') return { route: 'companies', jobId: null };
  if (first === 'admin' && IS_LOCAL) return { route: 'admin', jobId: null };
  if (first === 'jobs') return { route: 'jobs', jobId: second ? decodeURIComponent(second) : null };
  return { route: 'jobs', jobId: null };
}

/** The path for a route, or for one role. */
export function pathFor(route: Route, jobId?: string): string {
  if (jobId) return `${BASE}/jobs/${encodeURIComponent(jobId)}`;
  return route === 'jobs' ? `${BASE}/` : `${BASE}/${route}`;
}

/** The address for one role, absolute so it can be pasted anywhere. */
export function jobShareUrl(id: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}${pathFor('jobs', id)}`;
}

/** The path an old hash URL meant, or null if it wasn't one. */
export function pathFromLegacyHash(hash: string): string | null {
  const match = hash.match(/^#\/([^?#]*)/);
  if (!match) return null;
  const [first, second] = match[1].split('/');
  if (first === 'jobs' && second) return pathFor('jobs', decodeURIComponent(second));
  if (first === 'about' || first === 'post' || first === 'companies' || first === 'admin') {
    return pathFor(first as Route);
  }
  return first === '' ? pathFor('jobs') : null;
}
