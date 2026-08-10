import { Job } from './types';
import { dateValue } from './format';

const JOBS_URL = `${process.env.PUBLIC_URL || ''}/jobs.json`;

const isTruthy = (value: string) =>
  ['yes', 'true', '1', 'y'].includes(value.trim().toLowerCase());

const pipeList = (value: string) =>
  (value ?? '')
    .split('|')
    .map((v) => v.trim())
    .filter(Boolean);

// Roughly annualise a free-text salary so it can be range-filtered. Handles
// annual ranges ("$85,000-$95,000"), "k" shorthand, and hourly ("$38/hr",
// annualised at 38h × 52 weeks). Returns { min, max } in dollars, or 0s if none.
function parseSalaryAnnual(raw: string): { min: number; max: number } {
  const text = (raw ?? '').toLowerCase();
  const hourly = /\b(hr|hour|\/h)\b/.test(text) || text.includes('/hr');

  const values: number[] = [];
  const re = /([\d,]+(?:\.\d+)?)\s*(k)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    let n = parseFloat(m[1].replace(/,/g, ''));
    if (Number.isNaN(n)) continue;
    if (m[2]) n *= 1000;
    if (hourly) n *= 38 * 52;
    values.push(Math.round(n));
  }

  if (!values.length) return { min: 0, max: 0 };
  return { min: Math.min(...values), max: Math.max(...values) };
}

// The company's site, derived from the apply link's domain.
function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

function toJob(row: Record<string, string>): Job {
  return {
    id: row.id?.trim() ?? '',
    title: row.title?.trim() ?? '',
    company: row.company?.trim() ?? '',
    companyAbout: row.company_about?.trim() ?? '',
    companyUrl: row.company_url?.trim() || originOf(row.apply_url?.trim() ?? ''),
    location: row.location?.trim() ?? '',
    jobLevel: row.job_level?.trim() ?? '',
    type: row.type?.trim() ?? '',
    arrangement: row.arrangement?.trim() ?? '',
    salary: row.salary?.trim() ?? '',
    ...(() => {
      const { min, max } = parseSalaryAnnual(row.salary ?? '');
      return { salaryMinAnnual: min, salaryMaxAnnual: max };
    })(),
    educationLevel: row.education_level?.trim() ?? '',
    visaEligible: pipeList(row.visa_eligible ?? ''),
    visaPathways: pipeList(row.visa_pathways ?? ''),
    skillAssessment: row.skill_assessment?.trim() ?? '',
    anzsco: row.anzsco?.trim() ?? '',
    employerSponsored: isTruthy(row.employer_sponsored ?? ''),
    posted: row.posted?.trim() ?? '',
    closes: row.closes?.trim() ?? '',
    skills: pipeList(row.skills ?? ''),
    summary: row.summary?.trim() ?? '',
    applyUrl: row.apply_url?.trim() ?? '',
  };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Whether a role is still open on a given day, both dates being YYYY-MM-DD in
 * the viewer's timezone — ISO dates compare correctly as plain strings, which
 * sidesteps the timezone trap in parsing them.
 *
 * A role stays listed through its closing date and drops off the day after.
 * A missing or unreadable date means no deadline was given, so the role stays:
 * a blank field is not evidence that something has closed.
 */
export function isOpenOn(job: Job, today: string): boolean {
  const closes = job.closes.trim();
  if (!ISO_DATE.test(closes)) return true;
  return closes >= today;
}

export async function loadJobs(): Promise<Job[]> {
  const res = await fetch(JOBS_URL);
  if (!res.ok) throw new Error(`Could not load jobs (${res.status})`);

  const data = (await res.json()) as Record<string, string>[];
  if (!Array.isArray(data)) throw new Error('jobs.json must be an array of jobs');

  // Newest first, once, here — the list, the filtered views and the job picked
  // by default all inherit it, so there is one answer to "what order is this
  // in". A missing or unreadable date scores 0 and sinks to the bottom rather
  // than jumping the queue.
  return data
    .map(toJob)
    .filter((job) => job.id && job.title)
    .sort((a, b) => (dateValue(b.posted) || 0) - (dateValue(a.posted) || 0));
}
