// The shape of one row of content/jobs.csv, split into the two things a row actually
// describes: an employer and one of its open roles.

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
  openings: number;
  /**
   * The two migration answers, and both are three-valued on purpose: yes, no, or nobody has
   * checked yet.
   */
  accreditedSponsor: boolean | undefined;
  hiresInternationalStudents: boolean | undefined;
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
  anzscoUnitGroup: string;
  anzscoUnitGroupTitle: string;
  /** OSCA, the classification that replaced ANZSCO in December 2024. */
  oscaCodes: string[];
  oscaNames: string[];
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
