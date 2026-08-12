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

  test('a field left out of the file is simply empty, not a crash', async () => {
    // Fields the occupation answers are no longer written into jobs.json, so
    // most rows now arrive without them.
    const jobs = await withFile([
      { company: 'Acme', jobs: [{ id: '1', title: 'Engineer', posted: '2026-02-01' }] },
    ]);
    expect(jobs[0].skillAssessment).toBe('');
    expect(jobs[0].visaPathways).toEqual([]);
    expect(jobs[0].anzscos).toEqual([]);
    expect(jobs[0].companyAbout).toBe('');
    expect(jobs[0].salaryMaxAnnual).toBe(0);
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

describe('start date', () => {
  const withStart = async (start_date: string) => {
    (global as unknown as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: 'x', title: 'Role', posted: '2026-01-01', start_date }],
    });
    return (await loadJobs())[0];
  };

  test('is read separately from the date we listed the role', async () => {
    const job = await withStart('2026-09-01');
    expect(job.startDate).toBe('2026-09-01');
    expect(job.posted).toBe('2026-01-01');
  });

  test('a role with no start date loads rather than failing', async () => {
    expect((await withStart('')).startDate).toBe('');
  });
});

describe('the hiring manager', () => {
  const withContact = async (row: Record<string, string>) => {
    (global as unknown as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: 'x', title: 'Role', posted: '2026-01-01', ...row }],
    });
    return (await loadJobs())[0];
  };

  test('details are held but not published unless the poster said yes', async () => {
    // The regression this guards: a listing showing someone's name because the
    // field was filled in, rather than because they agreed to it.
    const quiet = await withContact({ contact_name: 'Alex Nguyen' });
    expect(quiet.contactName).toBe('Alex Nguyen');
    expect(quiet.contactPublic).toBe(false);

    const public_ = await withContact({ contact_name: 'Alex', contact_public: 'yes' });
    expect(public_.contactPublic).toBe(true);
  });

  test('name, position and LinkedIn are read when given', async () => {
    const job = await withContact({
      contact_name: 'Alex Nguyen',
      contact_position: 'Head of Engineering',
      contact_linkedin: 'https://www.linkedin.com/in/example',
    });
    expect(job.contactName).toBe('Alex Nguyen');
    expect(job.contactPosition).toBe('Head of Engineering');
    expect(job.contactLinkedin).toBe('https://www.linkedin.com/in/example');
  });

  test('a role with no contact loads with empty strings, not undefined', async () => {
    const job = await withContact({});
    expect(job.contactName).toBe('');
    expect(job.contactPosition).toBe('');
    expect(job.contactLinkedin).toBe('');
  });
});

describe('work arrangements', () => {
  const withArrangement = async (arrangement: string) => {
    (global as unknown as { fetch: unknown }).fetch = jest
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => [{ id: 'x', title: 'Role', posted: '2026-01-01', arrangement }],
      });
    return (await loadJobs())[0];
  };

  test('a role can offer more than one arrangement', async () => {
    expect((await withArrangement('Hybrid|Remote')).arrangements).toEqual([
      'Hybrid',
      'Remote',
    ]);
  });

  test('a single arrangement still works, so existing rows need no migration', async () => {
    expect((await withArrangement('Hybrid')).arrangements).toEqual(['Hybrid']);
  });

  test('a blank field yields none rather than one empty entry', async () => {
    expect((await withArrangement('')).arrangements).toEqual([]);
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

const closing = (closes: string, posted = '') => ({ closes, posted } as Job);

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

  test('a role with no dates at all stays, having nothing to judge it by', () => {
    expect(isOpenOn(closing(''), today)).toBe(true);
    expect(isOpenOn(closing('  '), today)).toBe(true);
    expect(isOpenOn(closing('15 Aug 2026'), today)).toBe(true);
  });

  describe('with no closing date', () => {
    test('stays up for three months after it was posted', () => {
      // Posted two months ago: still current.
      expect(isOpenOn(closing('', '2026-06-10'), today)).toBe(true);
    });

    test('lapses once three months have passed', () => {
      // Posted four months ago and never closed: almost certainly stale.
      expect(isOpenOn(closing('', '2026-04-10'), today)).toBe(false);
    });

    test('it lapses the day after the three-month mark, as a closing date does', () => {
      // Posted exactly three months ago: today is the last day it shows.
      expect(isOpenOn(closing('', '2026-05-10'), today)).toBe(true);
      // A day earlier, and it lapsed yesterday.
      expect(isOpenOn(closing('', '2026-05-09'), today)).toBe(false);
    });

    test('a closing date always wins over the three-month rule', () => {
      // Posted long ago but explicitly open until December.
      expect(isOpenOn(closing('2026-12-01', '2025-01-01'), today)).toBe(true);
    });
  });
});
