// The build script that picks the pre-loaded roles is plain CommonJS outside src/, so it is
// required rather than imported. The empty export makes this a module, which the production
// build's type-check requires of every file under src/ - a bare `require` is a global script.
export {};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { recentWindow, MAX_RECENT } = require('../scripts/recent-window');

const job = (id: string, posted: string) => ({ id, posted });

describe('the newest three days of roles', () => {
  test('a window ends on the newest posting and reaches two days back, inclusive', () => {
    const { from, to, jobs } = recentWindow(
      [
        job('a', '2026-09-17'),
        job('b', '2026-09-16'),
        job('c', '2026-09-15'),
        job('old', '2026-09-14'),
      ],
      '2026-09-19'
    );
    expect(to).toBe('2026-09-17');
    expect(from).toBe('2026-09-15');
    expect(jobs.map((j: { id: string }) => j.id)).toEqual(['a', 'b', 'c']);
  });

  test('it is anchored to the data, not to today, so an overdue refresh does not empty it', () => {
    // Nothing was posted for a week. Measured from today there would be no "last 3 days"; the
    // newest three there are is still what the page should lead with.
    const { jobs } = recentWindow([job('a', '2026-09-01'), job('b', '2026-08-20')], '2026-09-19');
    expect(jobs.map((j: { id: string }) => j.id)).toEqual(['a']);
  });

  test('a role dated in the future is a data error and cannot drag the window forward', () => {
    const { to, jobs } = recentWindow(
      [job('typo', '2027-01-01'), job('a', '2026-09-17')],
      '2026-09-19'
    );
    expect(to).toBe('2026-09-17');
    expect(jobs.map((j: { id: string }) => j.id)).toEqual(['a']);
  });

  test('roles with no readable date are left out rather than guessed at', () => {
    const { jobs } = recentWindow(
      [job('none', ''), job('junk', 'yesterday'), job('a', '2026-09-17')],
      '2026-09-19'
    );
    expect(jobs.map((j: { id: string }) => j.id)).toEqual(['a']);
  });

  test('it counts across a month boundary', () => {
    const { from, jobs } = recentWindow(
      [job('a', '2026-10-01'), job('b', '2026-09-30'), job('c', '2026-09-29')],
      '2026-10-02'
    );
    expect(from).toBe('2026-09-29');
    expect(jobs).toHaveLength(3);
  });

  test('newest first, and capped so the snapshot stays small', () => {
    const many = Array.from({ length: MAX_RECENT + 50 }, (_, i) => job(String(i), '2026-09-17'));
    const { jobs } = recentWindow(many, '2026-09-19');
    expect(jobs).toHaveLength(MAX_RECENT);
  });

  test('no dated roles gives an empty window, not an error', () => {
    expect(recentWindow([], '2026-09-19')).toEqual({ from: '', to: '', jobs: [] });
  });
});
