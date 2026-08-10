import { loadJobs, isOpenOn } from './jobs';
import { Job } from './types';

const row = (id: string, posted: string) => ({ id, title: `Role ${id}`, posted });

/** jobs.json in deliberately jumbled order, with one undated row. */
const ROWS = [
  row('older', '2026-01-10'),
  row('newest', '2026-06-01'),
  row('undated', ''),
  row('middle', '2026-03-05'),
];

beforeEach(() => {
  (global as unknown as { fetch: unknown }).fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ROWS });
});

afterEach(() => {
  jest.resetAllMocks();
});

test('jobs arrive newest first regardless of the order in the file', async () => {
  const jobs = await loadJobs();
  expect(jobs.map((j) => j.id)).toEqual(['newest', 'middle', 'older', 'undated']);
});

test('a job with no readable date sinks to the bottom rather than the top', async () => {
  const jobs = await loadJobs();
  expect(jobs[jobs.length - 1].id).toBe('undated');
});

const closing = (closes: string) => ({ closes } as Job);

describe('isOpenOn', () => {
  const today = '2026-08-10';

  test('a role closing today is still open', () => {
    expect(isOpenOn(closing('2026-08-10'), today)).toBe(true);
  });

  test('a role closing yesterday is gone', () => {
    expect(isOpenOn(closing('2026-08-09'), today)).toBe(false);
  });

  test('a future closing date is open', () => {
    expect(isOpenOn(closing('2026-12-01'), today)).toBe(true);
  });

  // Month and year boundaries are where naive string handling usually breaks.
  test('compares by date, not by lexical accident', () => {
    expect(isOpenOn(closing('2026-09-01'), '2026-08-31')).toBe(true);
    expect(isOpenOn(closing('2025-12-31'), '2026-01-01')).toBe(false);
  });

  test('a blank or malformed closing date is treated as no deadline', () => {
    expect(isOpenOn(closing(''), today)).toBe(true);
    expect(isOpenOn(closing('  '), today)).toBe(true);
    expect(isOpenOn(closing('15 Aug 2026'), today)).toBe(true);
  });
});
