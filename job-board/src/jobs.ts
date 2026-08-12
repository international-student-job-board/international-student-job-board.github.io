import { Job } from './types';
import { dateValue } from './format';

const JOBS_URL = `${process.env.PUBLIC_URL || ''}/jobs.json`;

const isTruthy = (value: string) =>
  ['yes', 'true', '1', 'y'].includes(value.trim().toLowerCase());

const isFalsy = (value: string) =>
  ['no', 'false', '0', 'n'].includes(value.trim().toLowerCase());

/** yes / no / never said. Anything unreadable counts as never said. */
function triState(value: string): boolean | undefined {
  if (isTruthy(value)) return true;
  if (isFalsy(value)) return false;
  return undefined;
}

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
    arrangements: pipeList(row.arrangement ?? ''),
    salary: row.salary?.trim() ?? '',
    ...(() => {
      const { min, max } = parseSalaryAnnual(row.salary ?? '');
      return { salaryMinAnnual: min, salaryMaxAnnual: max };
    })(),
    educationLevel: row.education_level?.trim() ?? '',
    visaEligible: pipeList(row.visa_eligible ?? ''),
    visaPathways: pipeList(row.visa_pathways ?? ''),
    skillAssessment: row.skill_assessment?.trim() ?? '',
    anzscos: pipeList(row.anzsco ?? ''),
    employerSponsored: triState(row.employer_sponsored ?? ''),
    contactPublic: isTruthy(row.contact_public ?? ''),
    contactName: row.contact_name?.trim() ?? '',
    contactPosition: row.contact_position?.trim() ?? '',
    contactLinkedin: row.contact_linkedin?.trim() ?? '',
    contactWebsite: row.contact_website?.trim() ?? '',
    contactEmail: row.contact_email?.trim() ?? '',
    posted: row.posted?.trim() ?? '',
    startDate: row.start_date?.trim() ?? '',
    closes: row.closes?.trim() ?? '',
    skills: pipeList(row.skills ?? ''),
    summary: row.summary?.trim() ?? '',
    applyUrl: row.apply_url?.trim() ?? '',
  };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** How long a listing with no closing date stays up. */
const MONTHS_WITHOUT_A_CLOSING_DATE = 3;

/** The same ISO date, that many calendar months later. */
function monthsLater(iso: string, months: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

/**
 * Whether a role is still open on a given day, both dates being YYYY-MM-DD in
 * the viewer's timezone — ISO dates compare correctly as plain strings, which
 * sidesteps the timezone trap in parsing them.
 *
 * A role stays listed through its closing date and drops off the day after.
 * With no closing date it lapses three months after it went up: an open-ended
 * listing is almost always one nobody came back to close, and a stale role
 * wastes more of a student's time than a missing one does.
 *
 * A role with no dates at all stays, because there is nothing to judge it by.
 */
export function isOpenOn(job: Job, today: string): boolean {
  const closes = job.closes.trim();
  if (ISO_DATE.test(closes)) return closes >= today;

  const posted = job.posted.trim();
  if (!ISO_DATE.test(posted)) return true;
  const lapses = monthsLater(posted, MONTHS_WITHOUT_A_CLOSING_DATE);
  return !lapses || lapses >= today;
}

/**
 * jobs.json is grouped by company: each entry carries the company's details
 * once and nests its roles under `jobs`. That keeps the blurb and link in a
 * single place per employer instead of repeating them on every role, which is
 * how they drift apart.
 *
 * A flat array of roles is still accepted, so the file can be edited either way
 * and older copies keep working.
 */
interface CompanyGroup {
  company?: string;
  company_about?: string;
  company_url?: string;
  jobs?: Record<string, string>[];
}

function flatten(data: (CompanyGroup & Record<string, string>)[]): Record<string, string>[] {
  return data.flatMap((entry) => {
    if (!Array.isArray(entry.jobs)) return [entry as Record<string, string>];
    const { jobs: roles, ...company } = entry;
    return roles.map((role) => ({ ...(company as Record<string, string>), ...role }));
  });
}

export async function loadJobs(): Promise<Job[]> {
  const res = await fetch(JOBS_URL);
  if (!res.ok) throw new Error(`Could not load jobs (${res.status})`);

  const raw = (await res.json()) as (CompanyGroup & Record<string, string>)[];
  if (!Array.isArray(raw)) throw new Error('jobs.json must be an array');
  const data = flatten(raw);

  // Newest first, once, here — the list, the filtered views and the job picked
  // by default all inherit it, so there is one answer to "what order is this
  // in". A missing or unreadable date scores 0 and sinks to the bottom rather
  // than jumping the queue.
  return data
    .map(toJob)
    .filter((job) => job.id && job.title)
    .sort((a, b) => (dateValue(b.posted) || 0) - (dateValue(a.posted) || 0));
}
