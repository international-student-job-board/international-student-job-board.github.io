// content/jobs.csv is the board: one row per open role, with the employer's
// columns repeated on each of its roles. It replaced a JSON file of roles and a
// separate CSV of companies — two sources that had to agree about the same
// employers and periodically didn't.
//
// In development the file is served by scripts/dev-server.js; a build copies it
// into the output. Either way the URL below is what the app asks for. See
// scripts/data-files.js for why it does not live in public/.

import { Job, Company } from './types';
import { parseCsv, splitList, triState, anzscoCodes } from './csv';
import { loadCompanies } from './companies';
import { dateValue } from './format';

const JOBS_URL = `${process.env.PUBLIC_URL || ''}/jobs.csv`;

/**
 * The CSV's column names, in file order.
 *
 * Exported because the admin writes rows in this exact order — one list, so a
 * column added here reaches the reader and the writer at the same time instead
 * of shifting every cell in the file by one.
 */
export const COLUMNS = [
  'Company name',
  'Segment',
  'Type',
  'Website',
  'Growth stage',
  'Employees',
  'Industries',
  'HQ city',
  'HQ address',
  'Tagline',
  'LinkedIn',
  'Profile',
  'Job openings',
  'Accredited sponsor',
  'Hires international students',
  'Job title',
  'Job type',
  'ANZSCO occupation',
  'ANZSCO 2022',
  'ANZSCO 2013',
  'Job city',
  'Job country',
  'Date posted',
  'Job URL',
  'Job ID',
] as const;

function toCompany(row: Record<string, string>): Company {
  return {
    name: (row['Company name'] ?? '').trim(),
    segment: (row['Segment'] ?? '').trim(),
    types: splitList(row['Type']),
    industries: splitList(row['Industries']),
    website: (row['Website'] ?? '').trim(),
    growthStage: (row['Growth stage'] ?? '').trim(),
    employees: (row['Employees'] ?? '').trim(),
    hqCity: (row['HQ city'] ?? '').trim(),
    hqAddress: (row['HQ address'] ?? '').trim(),
    tagline: (row['Tagline'] ?? '').trim(),
    linkedin: (row['LinkedIn'] ?? '').trim(),
    profile: (row['Profile'] ?? '').trim(),
    openings: Number.parseInt(row['Job openings'] ?? '', 10) || 0,
    accreditedSponsor: triState(row['Accredited sponsor']),
    hiresInternationalStudents: triState(row['Hires international students']),
  };
}

/**
 * Employers, folded out of the repeated columns.
 *
 * The first row for a company wins, and later rows only fill in what it left
 * blank. Rows for one employer are meant to agree; where they don't, one answer
 * has to be picked, and taking the first consistently at least makes the result
 * stable rather than dependent on which role happens to sort last.
 */
function foldCompanies(rows: Record<string, string>[]): Map<string, Company> {
  const byName = new Map<string, Company>();
  for (const row of rows) {
    const company = toCompany(row);
    if (!company.name) continue;
    const key = company.name.toLowerCase();
    const seen = byName.get(key);
    if (!seen) {
      byName.set(key, company);
      continue;
    }
    for (const [field, value] of Object.entries(company) as [keyof Company, never][]) {
      const current = seen[field];
      const empty =
        current === '' ||
        current === 0 ||
        current === undefined ||
        (Array.isArray(current) && current.length === 0);
      if (empty && value !== undefined) (seen[field] as unknown) = value;
    }
  }
  return byName;
}

function toJob(row: Record<string, string>, company: Company): Job {
  return {
    id: (row['Job ID'] ?? '').trim(),
    title: (row['Job title'] ?? '').trim(),
    type: (row['Job type'] ?? '').trim(),
    occupationNames: splitList(row['ANZSCO occupation']),
    anzsco2022: anzscoCodes(row['ANZSCO 2022']),
    anzsco2013: anzscoCodes(row['ANZSCO 2013']),
    city: (row['Job city'] ?? '').trim(),
    country: (row['Job country'] ?? '').trim(),
    posted: (row['Date posted'] ?? '').trim(),
    applyUrl: (row['Job URL'] ?? '').trim(),
    company,
  };
}

/**
 * Rows -> roles, newest first.
 *
 * The ordering happens once, here, so the list, the filtered views and the role
 * picked by default all inherit it and there is one answer to "what order is
 * this in". A missing or unreadable date scores 0 and sinks rather than jumping
 * the queue.
 *
 * A role with no id or no title is dropped: it can't be linked to or read, so
 * listing it only produces a card that goes nowhere.
 */
export function toJobs(rows: Record<string, string>[]): Job[] {
  const companies = foldCompanies(rows);
  return rows
    .map((row) => {
      const name = (row['Company name'] ?? '').trim().toLowerCase();
      return toJob(row, companies.get(name) ?? toCompany(row));
    })
    .filter((job) => job.id && job.title)
    .sort((a, b) => (dateValue(b.posted) || 0) - (dateValue(a.posted) || 0));
}

/** How long a role stays on the board after it was posted. */
export const MONTHS_LISTED = 2;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The same ISO date, that many calendar months earlier.
 *
 * The day is clamped to the target month's length rather than left to roll
 * forward: two months before 30 April is 28 February, not 2 March, and letting
 * it roll would quietly shorten the window in exactly the months where it is
 * hardest to notice.
 */
function monthsBefore(iso: string, months: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - months);
  const lastOfMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)
  ).getUTCDate();
  date.setUTCDate(Math.min(day, lastOfMonth));
  return date.toISOString().slice(0, 10);
}

/**
 * Whether a role is recent enough to still be worth showing, both dates being
 * YYYY-MM-DD — ISO dates compare correctly as plain strings, which sidesteps
 * the timezone trap in parsing them.
 *
 * `today` is the viewer's own date, so the board ages as they read it rather
 * than as of whenever it was last built.
 *
 * A role with no readable date stays. There is nothing to judge it by, and
 * dropping it would hide a listing over a fault in its metadata; the sort
 * already sinks it to the bottom.
 */
export function isRecent(job: Job, today: string): boolean {
  const posted = job.posted.trim();
  if (!ISO_DATE.test(posted)) return true;
  const cutoff = monthsBefore(today, MONTHS_LISTED);
  return !cutoff || posted >= cutoff;
}

/** The employers on the board, alphabetical, each with the roles it has listed. */
export function companiesFrom(jobs: Job[]): { company: Company; jobs: Job[] }[] {
  const byName = new Map<string, { company: Company; jobs: Job[] }>();
  for (const job of jobs) {
    const key = job.company.name.toLowerCase();
    if (!key) continue;
    const seen = byName.get(key);
    if (seen) seen.jobs.push(job);
    else byName.set(key, { company: job.company, jobs: [job] });
  }
  return Array.from(byName.values()).sort((a, b) =>
    a.company.name.localeCompare(b.company.name)
  );
}

/**
 * Fills each employer's gaps from the companies file.
 *
 * The two files carry the same company columns, but not the same answers: the
 * jobs export leaves "Hires international students" blank on every row, and
 * that question is only recorded on the companies list. Rather than special-
 * case those two columns, anything the jobs row left empty is taken from the
 * company's own record — the companies file is the fuller account of the
 * employer, and the jobs file is a snapshot of it taken per role.
 *
 * The jobs row still wins wherever it says something. It is the newer of the
 * two, and a role exported today knows more about its employer than a company
 * list compiled earlier.
 */
function enrich(jobs: Job[], companies: Company[]): Job[] {
  const byName = new Map(companies.map((c) => [c.name.trim().toLowerCase(), c]));
  const merged = new Map<string, Company>();

  return jobs.map((job) => {
    const key = job.company.name.trim().toLowerCase();
    const known = byName.get(key);
    if (!known) return job;

    // Merged once per employer, not once per role: 2,000 roles across 370
    // companies would otherwise rebuild the same object six times over.
    let company = merged.get(key);
    if (!company) {
      company = { ...job.company };
      for (const field of Object.keys(company) as (keyof Company)[]) {
        const mine = company[field];
        const empty =
          mine === '' || mine === undefined || (Array.isArray(mine) && mine.length === 0);
        if (empty) (company[field] as unknown) = known[field];
      }
      merged.set(key, company);
    }
    return { ...job, company };
  });
}

export async function loadJobs(): Promise<Job[]> {
  // Both are fetched together rather than in sequence: neither depends on the
  // other's contents, and the companies file is the larger of the two.
  const [res, companies] = await Promise.all([
    fetch(JOBS_URL),
    // A missing or broken companies file costs the two merged columns, not the
    // board. Roles are what this page is for.
    loadCompanies().catch(() => [] as Company[]),
  ]);
  if (!res.ok) throw new Error(`Could not load jobs (${res.status})`);
  return enrich(toJobs(parseCsv(await res.text())), companies);
}
