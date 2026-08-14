// The employers behind the "startups currently hiring" page, from content/companies.csv —
// its own file, separate from the jobs CSV. The two overlap: every row of jobs.csv also
// carries its employer's columns, and the jobs page reads those (see jobs.ts).

import { Company } from './types';
import { parseCsv, splitList, triState } from './csv';
import { dataUrl } from './dataUrl';

export type { Company } from './types';

const CSV_URL = dataUrl('/companies.csv');

/** The first of these columns the row actually has. */
const pick = (row: Record<string, string>, ...names: string[]) =>
  names.map((name) => row[name]).find((value) => value !== undefined) ?? '';

function toCompany(row: Record<string, string>): Company {
  return {
    name: pick(row, 'Company name').trim(),
    segment: pick(row, 'Segment').trim(),
    types: splitList(pick(row, 'Type')),
    industries: splitList(pick(row, 'Industries')),
    website: pick(row, 'Website').trim(),
    growthStage: pick(row, 'Growth stage').trim(),
    employees: pick(row, 'Employees').trim(),
    hqCity: pick(row, 'HQ city').trim(),
    hqAddress: pick(row, 'HQ address').trim(),
    tagline: pick(row, 'Tagline').trim(),
    linkedin: pick(row, 'LinkedIn').trim(),
    profile: pick(row, 'Profile').trim(),
    openings: Number.parseInt(pick(row, 'Job openings'), 10) || 0,
    accreditedSponsor: triState(pick(row, 'Accredited sponsor', 'Sponsor visa available')),
    hiresInternationalStudents: triState(pick(row, 'Hires international students')),
  };
}

let pending: Promise<Company[]> | null = null;

export function loadCompanies(): Promise<Company[]> {
  if (!pending) {
    pending = fetch(CSV_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load the company list (${res.status})`);
        return res.text();
      })
      .then((text) =>
        parseCsv(text)
          .map(toCompany)
          .filter((c) => c.name)
          .sort((a, b) => a.name.localeCompare(b.name))
      )
      .catch((err) => {
        pending = null;
        throw err;
      });
  }
  return pending;
}

export type CompanySort = 'openings' | 'name';

/** Sorted for display: most roles first, or alphabetically. */
export function sortCompanies(companies: Company[], sort: CompanySort): Company[] {
  const sorted = [...companies];
  if (sort === 'name') return sorted.sort((a, b) => a.name.localeCompare(b.name));
  // Ties fall back to the name, so equal counts don't shuffle between renders.
  return sorted.sort((a, b) => b.openings - a.openings || a.name.localeCompare(b.name));
}

/** Companies matching a query on name, industry or what they build. */
export function searchCompanies(companies: Company[], query: string): Company[] {
  const q = query.trim().toLowerCase();
  if (!q) return companies;

  const rank = (c: Company): number => {
    const name = c.name.toLowerCase();
    if (name === q) return 0;
    if (name.startsWith(q)) return 1;
    if (name.includes(q)) return 2;
    if (c.industries.some((i) => i.toLowerCase().includes(q))) return 3;
    if (c.types.some((t) => t.toLowerCase().includes(q))) return 4;
    if (c.tagline.toLowerCase().includes(q)) return 5;
    return -1;
  };

  return companies
    .map((company) => ({ company, score: rank(company) }))
    .filter((hit) => hit.score >= 0)
    .sort((a, b) => a.score - b.score || a.company.name.localeCompare(b.company.name))
    .map((hit) => hit.company);
}

/** Case-insensitive lookup, for filling in a company a poster has named. */
export function findCompany(companies: Company[], name: string): Company | undefined {
  const key = name.trim().toLowerCase();
  if (!key) return undefined;
  return companies.find((c) => c.name.toLowerCase() === key);
}
