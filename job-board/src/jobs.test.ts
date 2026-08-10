import { loadJobs, isOpenOn } from './jobs';
import { Job } from './types';

const row = (id: string, posted: string, anzsco = '') => ({
  id,
  title: `Role ${id}`,
  posted,
  anzsco,
});

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

describe('nested companies', () => {
  const withFile = async (data: unknown) => {
    (global as unknown as { fetch: unknown }).fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => data });
    return loadJobs();
  };

  test('a company\'s details are copied onto each of its roles', async () => {
    const jobs = await withFile([
      {
        company: 'Acme',
        company_about: 'We make anvils.',
        company_url: 'https://acme.test',
        jobs: [
          { id: '1', title: 'Engineer', posted: '2026-02-01' },
          { id: '2', title: 'Designer', posted: '2026-03-01' },
        ],
      },
    ]);

    expect(jobs).toHaveLength(2);
    jobs.forEach((job) => {
      expect(job.company).toBe('Acme');
      expect(job.companyAbout).toBe('We make anvils.');
      expect(job.companyUrl).toBe('https://acme.test');
    });
  });

  test('a role can override a company detail for itself', async () => {
    const jobs = await withFile([
      {
        company: 'Acme',
        company_url: 'https://acme.test',
        jobs: [{ id: '1', title: 'Engineer', posted: '2026-02-01', company_url: 'https://sub.test' }],
      },
    ]);
    expect(jobs[0].companyUrl).toBe('https://sub.test');
  });

  test('a flat file of roles still loads, so older copies keep working', async () => {
    const jobs = await withFile([
      { id: '1', title: 'Engineer', company: 'Acme', posted: '2026-02-01' },
    ]);
    expect(jobs[0].company).toBe('Acme');
  });

  test('roles from different companies are still sorted newest first', async () => {
    const jobs = await withFile([
      { company: 'A', jobs: [{ id: '1', title: 'Old', posted: '2026-01-01' }] },
      { company: 'B', jobs: [{ id: '2', title: 'New', posted: '2026-09-01' }] },
    ]);
    expect(jobs.map((j) => j.title)).toEqual(['New', 'Old']);
  });
});

describe('occupations', () => {
  const withAnzsco = async (anzsco: string) => {
    (global as unknown as { fetch: unknown }).fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => [row('x', '2026-01-01', anzsco)] });
    return (await loadJobs())[0];
  };

  test('a pipe-separated list becomes several occupations', async () => {
    expect((await withAnzsco('261313|233999')).anzscos).toEqual(['261313', '233999']);
  });

  test('a single code still works, so existing rows need no migration', async () => {
    expect((await withAnzsco('261313')).anzscos).toEqual(['261313']);
  });

  test('a blank field yields none rather than one empty entry', async () => {
    expect((await withAnzsco('')).anzscos).toEqual([]);
  });
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
