import Papa from 'papaparse';
import { Job } from './types';

const CSV_URL = `${process.env.PUBLIC_URL || ''}/jobs.csv`;

const isTruthy = (value: string) =>
  ['yes', 'true', '1', 'y'].includes(value.trim().toLowerCase());

const pipeList = (value: string) =>
  (value ?? '')
    .split('|')
    .map((v) => v.trim())
    .filter(Boolean);

// Roughly annualise a free-text salary so it can be range-filtered. Handles
// annual ranges ("$85,000–$95,000"), "k" shorthand, and hourly ("$38/hr",
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
    employerSponsored: isTruthy(row.employer_sponsored ?? ''),
    posted: row.posted?.trim() ?? '',
    closes: row.closes?.trim() ?? '',
    skills: pipeList(row.skills ?? ''),
    summary: row.summary?.trim() ?? '',
    dayToDay: row.day_to_day?.trim() ?? '',
    dailySkills: pipeList(row.daily_skills ?? ''),
    companyValues: pipeList(row.company_values ?? ''),
    careerAdvancement: row.career_advancement?.trim() ?? '',
    description: row.description?.trim() ?? '',
    applyUrl: row.apply_url?.trim() ?? '',
  };
}

export async function loadJobs(): Promise<Job[]> {
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`Could not load jobs (${res.status})`);
  const text = await res.text();

  const { data, errors } = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  if (errors.length) throw new Error(errors[0].message);

  return data.map(toJob).filter((job) => job.id && job.title);
}
