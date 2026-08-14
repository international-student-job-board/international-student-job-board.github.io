// content/jobs.csv is the board: one row per open role, with the employer's columns
// repeated on each of its roles.

import { Job, Company } from './types';
import { parseCsv, splitList, splitNames, triState, anzscoCodes, unitGroupCodes } from './csv';
import { loadCompanies } from './companies';
import { dateValue } from './format';
import { setUnitGroupTitles } from './references';
import { dataUrl } from './dataUrl';

const JOBS_URL = dataUrl('/jobs.csv');

/** The CSV's column names, in file order. */
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
  'ANZSCO unit group',
  'ANZSCO unit group title',
  'OSCA occupation',
  'OSCA code',
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

/** Employers, folded out of the repeated columns. */
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
    occupationNames: splitNames(row['ANZSCO occupation']),
    anzsco2022: anzscoCodes(row['ANZSCO 2022']),
    anzsco2013: anzscoCodes(row['ANZSCO 2013']),
    anzscoUnitGroups: unitGroupCodes(row['ANZSCO unit group']),
    anzscoUnitGroupTitles: splitNames(row['ANZSCO unit group title']),
    oscaCodes: anzscoCodes(row['OSCA code']),
    oscaNames: splitNames(row['OSCA occupation']),
    city: (row['Job city'] ?? '').trim(),
    country: (row['Job country'] ?? '').trim(),
    posted: (row['Date posted'] ?? '').trim(),
    applyUrl: (row['Job URL'] ?? '').trim(),
    company,
  };
}

/** Rows -> roles, newest first. */
export function toJobs(rows: Record<string, string>[]): Job[] {
  const companies = foldCompanies(rows);

  // The four-digit titles live only in this file, so they are registered for
  // whatever needs to name a unit group later.
  const titles: Record<string, string> = {};
  for (const row of rows) {
    const codes = unitGroupCodes(row['ANZSCO unit group']);
    const names = splitNames(row['ANZSCO unit group title']);
    codes.forEach((code, i) => {
      if (names[i] && !titles[code]) titles[code] = names[i];
    });
  }
  setUnitGroupTitles(titles);

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

/** The same ISO date, that many calendar months earlier. */
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
 * Whether a role is recent enough to still be worth showing, both dates being YYYY-MM-DD —
 * ISO dates compare correctly as plain strings, which sidesteps the timezone trap in
 * parsing them.
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

/** Fills each employer's gaps from the companies file. */
function enrich(jobs: Job[], companies: Company[]): Job[] {
  const byName = new Map(companies.map((c) => [c.name.trim().toLowerCase(), c]));
  const merged = new Map<string, Company>();

  return jobs.map((job) => {
    const key = job.company.name.trim().toLowerCase();
    const known = byName.get(key);
    if (!known) return job;

    // Merged once per employer, not once per role: 2,000 roles across 370 companies would
    // otherwise rebuild the same object six times over.
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
  // Both are fetched together rather than in sequence: neither depends on the other's
  // contents, and the companies file is the larger of the two.
  const [res, companies] = await Promise.all([
    fetch(JOBS_URL),
    // A missing or broken companies file costs the two merged columns, not the board.
    loadCompanies().catch(() => [] as Company[]),
  ]);
  if (!res.ok) throw new Error(`Could not load jobs (${res.status})`);
  return enrich(toJobs(parseCsv(await res.text())), companies);
}
