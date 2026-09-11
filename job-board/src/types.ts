// The shape of one row of content/jobs.csv, split into the two things a row actually
// describes: an employer and one of its open roles.

export interface Company {
  name: string;
  /** The state the employer is in - the board is national now. */
  state: string;
  /** "startup" or "scaleup". */
  segment: string;
  /** What the company builds - big data, saas, machine learning… */
  types: string[];
  /** The markets it sells into - fintech, health, marketing… */
  industries: string[];
  website: string;
  growthStage: string;
  employees: string;
  hqCity: string;
  /** Free-text HQ address; the postcode in it is what places the map pin. */
  hqAddress: string;
  /** The company's own one-liner. */
  tagline: string;
  linkedin: string;
  openings: number;
  /**
   * The two migration answers, and both are three-valued on purpose: yes, no, or nobody has
   * checked yet.
   */
  accreditedSponsor: boolean | undefined;
  hiresInternationalStudents: boolean | undefined;
  /** Glassdoor's overall rating out of 5, the review count behind it, and the
   * Overview page - undefined when we couldn't match the company on Glassdoor. */
  glassdoorRating?: number;
  glassdoorReviews?: number;
  glassdoorUrl?: string;
}

export interface Job {
  id: string;
  title: string;
  /** Full-time, Part-time, Internship… as written in the CSV. */
  type: string;
  /** The ANZSCO occupations this role maps to, by name. */
  occupationNames: string[];
  /**
   * The codes, kept apart by classification version because the visas are: subclasses 186
   * and 482 use ANZSCO 2022, every other visa still uses ANZSCO 2013. They agree for most
   * occupations but not all, and merging them would silently hand the wrong code to
   * whichever visa lost.
   */
  anzsco2022: string[];
  anzsco2013: string[];
  /**
   * The four-digit ANZSCO unit group, which is as far as some roles can be
   * placed. A job title that maps to no single six-digit occupation often still
   * belongs clearly to a group of them.
   */
  anzscoUnitGroups: string[];
  anzscoUnitGroupTitles: string[];
  /** OSCA, the classification that replaced ANZSCO in December 2024. */
  oscaCodes: string[];
  oscaNames: string[];
  /**
   * The minimum score SkillSelect invited at, in the round most recently fetched, for this
   * role's matched occupation. Undefined when that occupation wasn't in it - not the same
   * as a score of zero, so left unset rather than defaulted.
   */
  invitedScore?: number;
  city: string;
  /**
   * The state on this role's row.
   *
   * Not taken from the employer: the fold keeps one company per name and the
   * first row's state with it, so a Sydney-based company hiring in Melbourne
   * would have every one of its roles reading "Melbourne, New South Wales".
   */
  state: string;
  country: string;
  /**
   * When the role was posted - the advert's own date where we could read one
   * (often weeks before the CSV's "Date posted", which is really Dealroom's
   * discovery date and batches many roles onto one day), otherwise that. Orders
   * the board and drives the recency filter.
   */
  posted: string;
  /** True when `posted` came from the advert's coarse "N weeks ago" - a good
   * sort key, but not a date to render to the day. */
  postedApprox: boolean;
  applyUrl: string;
  company: Company;
  /**
   * Working conditions, enriched from levels.fyi (and the advert where it is
   * scrapeable) by the data pipeline. Each is one of the pick-lists in
   * content/constants.json, or '' when nothing reliable was found.
   */
  employmentType: string;
  jobLevel: string;
  workArrangement: string;
  /** Degrees the advert mentions - a role can name more than one. */
  educationLevels: string[];
  salary: Salary;
}

/**
 * A role's pay, as far as it is known.
 *
 *  - `base` is a base-salary range, in its original currency and converted to AUD.
 *  - `estimateAud` is a single "typical" AUD figure (Glassdoor's median, or
 *    levels.fyi's total-comp estimate).
 *  - `source` is where the figure came from: `advert` (the employer published
 *    it - not an estimate), `glassdoor` or `levels.fyi` (an estimate).
 *  - `sourceUrl` is the page to link to for a Glassdoor / levels.fyi figure.
 *
 * `isEstimate` is derived: true unless the source is the advert.
 */
export type SalarySource = 'advert' | 'glassdoor' | 'levels.fyi' | '';

export interface Salary {
  base?: { min?: number; max?: number; currency: string; minAud?: number; maxAud?: number };
  estimateAud?: number;
  source: SalarySource;
  sourceUrl: string;
  isEstimate: boolean;
}

/** True when a role carries any pay figure at all. */
export function hasSalary(salary: Salary): boolean {
  return Boolean(salary.base?.minAud || salary.base?.maxAud || salary.estimateAud);
}

/** The lowest and highest AUD figure a role's pay spans, for the range filter. */
export function salaryRangeAud(salary: Salary): [number, number] | null {
  const points = [salary.base?.minAud, salary.base?.maxAud, salary.estimateAud].filter(
    (n): n is number => typeof n === 'number' && n > 0
  );
  if (!points.length) return null;
  return [Math.min(...points), Math.max(...points)];
}

/**
 * "Melbourne, Australia" - what the card, the detail page and the search
 * snippet all show.
 *
 * The state is deliberately absent. The file records it per row but it tracks
 * the employer rather than the role, so pairing it with the role's city
 * produced "Melbourne, Queensland" on 577 of 4,340 rows. It is shown with the
 * employer instead, where it is true.
 */
export function jobLocation(job: Job): string {
  return [job.city, job.country]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(', ');
}
