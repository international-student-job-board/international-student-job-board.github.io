import { render, screen } from '@testing-library/react';
import App from './App';
import { jobShareUrl, parsePath, pathFor, pathFromLegacyHash } from './routes';

test('the board leads with exactly one top-level heading', () => {
  // Not the wording, which is marketing copy and changes often. What has to
  // hold is that there is one h1 and it says something — an earlier edit left
  // two on the page, which this catches.
  render(<App />);
  const headings = screen.getAllByRole('heading', { level: 1 });
  expect(headings).toHaveLength(1);
  expect(headings[0].textContent?.trim().length).toBeGreaterThan(0);
});

describe('a role has its own address', () => {
  test('the share URL is a path, absolute, so it can be pasted anywhere', () => {
    const url = jobShareUrl('7');
    expect(url).toContain('/jobs/7');
    expect(url).not.toContain('#');
    expect(url.startsWith('http')).toBe(true);
  });

  test('an id needing escaping survives the round trip', () => {
    const url = jobShareUrl('a b/c');
    expect(url).toContain(encodeURIComponent('a b/c'));
    expect(parsePath(new URL(url).pathname).jobId).toBe('a b/c');
  });
});

describe('reading the address', () => {
  test('the bare path is the board', () => {
    expect(parsePath('/')).toEqual({ route: 'jobs', jobId: null });
    expect(parsePath('')).toEqual({ route: 'jobs', jobId: null });
  });

  test('each page has its own path', () => {
    expect(parsePath('/companies').route).toBe('companies');
    expect(parsePath('/about').route).toBe('about');
    expect(parsePath('/post').route).toBe('post');
  });

  test('a role path carries its id', () => {
    expect(parsePath('/jobs/85124171')).toEqual({ route: 'jobs', jobId: '85124171' });
  });

  test('a trailing slash means the same thing', () => {
    expect(parsePath('/companies/')).toEqual({ route: 'companies', jobId: null });
  });

  test('an unknown path falls back to the board rather than a dead end', () => {
    // 404.html is the app, so anything can arrive here; landing on the board beats showing
    // an error page for a URL we simply do not have.
    expect(parsePath('/nonsense/deeper').route).toBe('jobs');
  });

  test('building a path and reading it back agree', () => {
    expect(parsePath(pathFor('companies')).route).toBe('companies');
    expect(parsePath(pathFor('jobs', '42')).jobId).toBe('42');
  });
});

describe('links shared before the move off hashes', () => {
  test('an old role link becomes its path', () => {
    // #/jobs/7 is out in the world already — shared, bookmarked, sitting in someone's
    // messages — so it has to keep landing on the right role.
    expect(pathFromLegacyHash('#/jobs/7')).toBe(pathFor('jobs', '7'));
  });

  test('old page links too', () => {
    expect(pathFromLegacyHash('#/companies')).toBe(pathFor('companies'));
    expect(pathFromLegacyHash('#/about')).toBe(pathFor('about'));
  });

  test('an escaped id is decoded before being rebuilt', () => {
    expect(pathFromLegacyHash('#/jobs/a%20b')).toBe(pathFor('jobs', 'a b'));
  });

  test('a plain anchor is left alone', () => {
    // #top is a link within the page, not a route.
    expect(pathFromLegacyHash('#top')).toBeNull();
    expect(pathFromLegacyHash('')).toBeNull();
  });
});
