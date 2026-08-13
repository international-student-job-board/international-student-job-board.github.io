import { toJobs, companiesFrom, isRecent, MONTHS_LISTED, COLUMNS } from './jobs';
import { parseCsv, escapeCell, toCsvRow, splitList, anzscoCodes, triState } from './csv';

const HEADER = COLUMNS.join(',');

/** One CSV, built from partial rows so a test only states what it is about. */
const csv = (...rows: Record<string, string>[]) =>
  [HEADER, ...rows.map((r) => toCsvRow(r, [...COLUMNS]))].join('\n');

const row = (over: Record<string, string> = {}) => ({
  'Company name': 'Acme',
  'Job title': 'Engineer',
  'Job ID': '1',
  'Date posted': '2026-01-01',
  ...over,
});

describe('reading the CSV', () => {
  test('a row becomes a role with its employer attached', () => {
    const [job] = toJobs(parseCsv(csv(row({ 'Job type': 'Full-time', Tagline: 'We build things' }))));
    expect(job.title).toBe('Engineer');
    expect(job.type).toBe('Full-time');
    expect(job.company.name).toBe('Acme');
    expect(job.company.tagline).toBe('We build things');
  });

  test('a comma inside a cell survives the round trip', () => {
    const [job] = toJobs(parseCsv(csv(row({ 'Company name': 'Acme, Inc', Tagline: 'Fast, cheap' }))));
    expect(job.company.name).toBe('Acme, Inc');
    expect(job.company.tagline).toBe('Fast, cheap');
  });

  test('roles with no id or no title are dropped, since neither can be opened', () => {
    const jobs = toJobs(
      parseCsv(csv(row(), row({ 'Job ID': '2', 'Job title': '' }), row({ 'Job ID': '' })))
    );
    expect(jobs.map((j) => j.id)).toEqual(['1']);
  });

  test('newest first, and an unreadable date sinks rather than jumping the queue', () => {
    const jobs = toJobs(
      parseCsv(
        csv(
          row({ 'Job ID': '1', 'Date posted': '2026-01-01' }),
          row({ 'Job ID': '2', 'Date posted': '2026-06-01' }),
          row({ 'Job ID': '3', 'Date posted': 'sometime' })
        )
      )
    );
    expect(jobs.map((j) => j.id)).toEqual(['2', '1', '3']);
  });

  test('the location is the city and country together', () => {
    const [job] = toJobs(parseCsv(csv(row({ 'Job city': 'Melbourne', 'Job country': 'Australia' }))));
    expect(job.city).toBe('Melbourne');
    expect(job.country).toBe('Australia');
  });
});

describe('several ANZSCO codes on one role', () => {
  test('codes are read by shape, whatever separates them', () => {
    expect(anzscoCodes('261312|261313')).toEqual(['261312', '261313']);
    expect(anzscoCodes('261312, 261313')).toEqual(['261312', '261313']);
    expect(anzscoCodes('ANZSCO 261312 / 261313')).toEqual(['261312', '261313']);
  });

  test('stray numbers that are not six digits are not codes', () => {
    expect(anzscoCodes('2613 and 12345')).toEqual([]);
  });

  test('the same code twice is one code', () => {
    expect(anzscoCodes('261313; 261313')).toEqual(['261313']);
  });

  test('the two classification versions stay apart', () => {
    const [job] = toJobs(
      parseCsv(csv(row({ 'ANZSCO 2022': '224114', 'ANZSCO 2013': '224999' })))
    );
    expect(job.anzsco2022).toEqual(['224114']);
    expect(job.anzsco2013).toEqual(['224999']);
  });
});

describe('multi-value cells', () => {
  test('semicolons, pipes and comma-space all separate', () => {
    expect(splitList('saas;fintech')).toEqual(['saas', 'fintech']);
    expect(splitList('saas|fintech')).toEqual(['saas', 'fintech']);
    expect(splitList('saas, fintech')).toEqual(['saas', 'fintech']);
  });

  test('a lone value comes back whole', () => {
    expect(splitList('machine learning')).toEqual(['machine learning']);
  });
});

describe('yes / no / nobody said', () => {
  test('reads the affirmative spellings', () => {
    ['Yes', 'yes', 'TRUE', '1', 'y'].forEach((v) => expect(triState(v)).toBe(true));
  });

  test('reads the negative ones', () => {
    ['No', 'no', 'false', '0'].forEach((v) => expect(triState(v)).toBe(false));
  });

  test('blank and unreadable both mean nobody said, which is not "no"', () => {
    expect(triState('')).toBeUndefined();
    expect(triState('maybe')).toBeUndefined();
  });
});

describe('folding the repeated employer columns', () => {
  test('two roles at one employer share one company', () => {
    const jobs = toJobs(
      parseCsv(
        csv(
          row({ 'Job ID': '1', Tagline: 'We build things' }),
          row({ 'Job ID': '2', 'Job title': 'Designer' })
        )
      )
    );
    expect(jobs).toHaveLength(2);
    expect(jobs[0].company.tagline).toBe('We build things');
    // The second row left the tagline blank; it still gets the company's.
    expect(jobs[1].company.tagline).toBe('We build things');
  });

  test('the employer is matched regardless of case', () => {
    const jobs = toJobs(
      parseCsv(csv(row({ 'Job ID': '1' }), row({ 'Job ID': '2', 'Company name': 'ACME' })))
    );
    expect(companiesFrom(jobs)).toHaveLength(1);
  });

  test('companiesFrom groups the roles under their employer, alphabetically', () => {
    const jobs = toJobs(
      parseCsv(
        csv(
          row({ 'Job ID': '1', 'Company name': 'Zeta' }),
          row({ 'Job ID': '2', 'Company name': 'Acme' }),
          row({ 'Job ID': '3', 'Company name': 'Acme' })
        )
      )
    );
    const grouped = companiesFrom(jobs);
    expect(grouped.map((g) => g.company.name)).toEqual(['Acme', 'Zeta']);
    expect(grouped[0].jobs).toHaveLength(2);
  });
});

describe('writing cells back out', () => {
  test('only values that need quotes get them', () => {
    expect(escapeCell('Acme')).toBe('Acme');
    expect(escapeCell('Acme, Inc')).toBe('"Acme, Inc"');
    expect(escapeCell('He said "hi"')).toBe('"He said ""hi"""');
  });

  test('a newline inside a value would break the row, so it becomes a space', () => {
    expect(escapeCell('one\ntwo')).toBe('one two');
  });

  test('a row is written in column order, with gaps left empty', () => {
    const line = toCsvRow({ 'Company name': 'Acme', 'Job ID': '7' }, [...COLUMNS]);
    const cells = line.split(',');
    expect(cells[COLUMNS.indexOf('Company name')]).toBe('Acme');
    expect(cells[COLUMNS.indexOf('Job ID')]).toBe('7');
    expect(cells).toHaveLength(COLUMNS.length);
  });
});

describe('filling the employer’s gaps from the companies file', () => {
  const JOB_HEADER = COLUMNS.join(',');
  const COMPANY_COLUMNS = COLUMNS.slice(0, COLUMNS.indexOf('Job title')) as unknown as string[];
  const COMPANY_HEADER = COMPANY_COLUMNS.join(',');

  /**
   * loadJobs fetches two files and loadCompanies memoises, so each case needs a
   * fresh module registry and a stub that answers by URL.
   */
  const load = async (jobsCsv: string, companiesCsv: string) => {
    jest.resetModules();
    (global as unknown as { fetch: jest.Mock }).fetch = jest.fn(async (url: string) => ({
      ok: true,
      text: async () => (String(url).includes('companies') ? companiesCsv : jobsCsv),
    }));
    const mod: typeof import('./jobs') = require('./jobs');
    return mod.loadJobs();
  };

  const jobRow = (over: Record<string, string> = {}) =>
    toCsvRow({ 'Company name': 'Acme', 'Job title': 'Engineer', 'Job ID': '1', ...over }, [
      ...COLUMNS,
    ]);

  const companyRow = (over: Record<string, string> = {}) =>
    toCsvRow({ 'Company name': 'Acme', ...over }, COMPANY_COLUMNS);

  test('an answer only the companies file holds reaches the role', async () => {
    // The jobs export leaves this column blank on every row; the companies
    // list is the only place it is recorded.
    const [job] = await load(
      `${JOB_HEADER}\n${jobRow()}`,
      `${COMPANY_HEADER}\n${companyRow({ 'Hires international students': 'True' })}`
    );
    expect(job.company.hiresInternationalStudents).toBe(true);
  });

  test('the jobs file wins wherever it says something', async () => {
    const [job] = await load(
      `${JOB_HEADER}\n${jobRow({ Tagline: 'From the jobs file' })}`,
      `${COMPANY_HEADER}\n${companyRow({ Tagline: 'From the companies file' })}`
    );
    expect(job.company.tagline).toBe('From the jobs file');
  });

  test('an employer missing from the companies file is left as it came', async () => {
    const [job] = await load(
      `${JOB_HEADER}\n${jobRow({ 'Company name': 'Nowhere' })}`,
      `${COMPANY_HEADER}\n${companyRow()}`
    );
    expect(job.company.name).toBe('Nowhere');
    expect(job.company.hiresInternationalStudents).toBeUndefined();
  });

  test('matching ignores case, since the two files are compiled separately', async () => {
    const [job] = await load(
      `${JOB_HEADER}\n${jobRow({ 'Company name': 'ACME' })}`,
      `${COMPANY_HEADER}\n${companyRow({ 'Hires international students': 'True' })}`
    );
    expect(job.company.hiresInternationalStudents).toBe(true);
  });

  test('roles at one employer share the merged company, not a copy each', async () => {
    const jobs = await load(
      `${JOB_HEADER}\n${jobRow()}\n${jobRow({ 'Job ID': '2', 'Job title': 'Designer' })}`,
      `${COMPANY_HEADER}\n${companyRow({ 'Hires international students': 'True' })}`
    );
    expect(jobs[0].company).toBe(jobs[1].company);
  });

  test('a broken companies file costs the merge, not the board', async () => {
    jest.resetModules();
    (global as unknown as { fetch: jest.Mock }).fetch = jest.fn(async (url: string) =>
      String(url).includes('companies')
        ? { ok: false, status: 500 }
        : { ok: true, text: async () => `${JOB_HEADER}\n${jobRow()}` }
    );
    const mod: typeof import('./jobs') = require('./jobs');
    const jobs = await mod.loadJobs();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].company.hiresInternationalStudents).toBeUndefined();
  });
});

describe('roles older than the listing window', () => {
  const job = (posted: string) =>
    toJobs([
      { 'Company name': 'Acme', 'Job title': 'Engineer', 'Job ID': '1', 'Date posted': posted },
    ])[0];

  test('a role posted today is shown', () => {
    expect(isRecent(job('2026-08-13'), '2026-08-13')).toBe(true);
  });

  test('a role posted exactly two months ago is still shown', () => {
    // The boundary belongs to the role: "over two months ago" is what is being
    // excluded, so two months to the day is not yet over it.
    expect(isRecent(job('2026-06-13'), '2026-08-13')).toBe(true);
  });

  test('a day older than that is gone', () => {
    expect(isRecent(job('2026-06-12'), '2026-08-13')).toBe(false);
  });

  test('last year’s roles are gone', () => {
    expect(isRecent(job('2025-04-11'), '2026-08-13')).toBe(false);
  });

  test('the window is calendar months, and crosses a year boundary', () => {
    expect(isRecent(job('2025-11-15'), '2026-01-15')).toBe(true);
    expect(isRecent(job('2025-11-14'), '2026-01-15')).toBe(false);
  });

  test('a short month does not quietly shorten the window', () => {
    // Two months before 30 April is 28 February, not 2 March — letting the day
    // roll forward would drop three days of roles in exactly the months where
    // nobody would think to check.
    expect(isRecent(job('2026-02-28'), '2026-04-30')).toBe(true);
    expect(isRecent(job('2026-02-27'), '2026-04-30')).toBe(false);
  });

  test('a role with no readable date stays, having nothing to judge it by', () => {
    expect(isRecent(job('sometime'), '2026-08-13')).toBe(true);
    expect(isRecent(job(''), '2026-08-13')).toBe(true);
  });

  test('the window is two months', () => {
    expect(MONTHS_LISTED).toBe(2);
  });
});
