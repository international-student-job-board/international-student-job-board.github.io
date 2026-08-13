// The shape of one row of content/jobs.csv, split into the two things a row
// actually describes: an employer and one of its open roles.
//
// The CSV repeats the employer's columns on every one of its roles, which is
// the right trade for a file people edit by hand but the wrong one for the app —
// so the loader folds the repeats back into a single Company that every role at
// that employer shares. See COLUMNS in jobs.ts for the mapping.

export interface Company {
  name: string;
  /** "startup" or "scaleup". */
  segment: string;
  /** What the company builds — big data, saas, machine learning… */
  types: string[];
  /** The markets it sells into — fintech, health, marketing… */
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
  /** Its page on whichever startup directory the row was compiled from. */
  profile: string;
  /** Roles the company said it had open, which is not the same as how many of
      them are listed here. Kept for reference; the board counts its own. */
  openings: number;
  /**
   * The two migration answers, and both are three-valued on purpose: yes, no,
   * or nobody has checked yet. Blank means unchecked, not "no" — collapsing
   * them would have the site tell a student a company had been ruled out when
   * nobody had ruled anything.
   */
  accreditedSponsor: boolean | undefined;
  hiresInternationalStudents: boolean | undefined;
}

export interface Job {
  id: string;
  title: string;
  /** Full-time, Part-time, Internship… as written in the CSV. */
  type: string;
  /**
   * The ANZSCO occupations this role maps to, by name. A role can sit across
   * more than one, and which one an applicant is assessed under changes their
   * visa options — so the board keeps all of them rather than forcing a choice.
   */
  occupationNames: string[];
  /**
   * The codes, kept apart by classification version because the visas are:
   * subclasses 186 and 482 use ANZSCO 2022, every other visa still uses ANZSCO
   * 2013. They agree for most occupations but not all, and merging them would
   * silently hand the wrong code to whichever visa lost.
   */
  anzsco2022: string[];
  anzsco2013: string[];
  city: string;
  country: string;
  /** When the role was posted. Orders the board and drives the recency filter. */
  posted: string;
  applyUrl: string;
  company: Company;
}

/** "Melbourne, Australia" — what the card and the detail page both show. */
export function jobLocation(job: Job): string {
  return [job.city, job.country].map((s) => s.trim()).filter(Boolean).join(', ');
}
