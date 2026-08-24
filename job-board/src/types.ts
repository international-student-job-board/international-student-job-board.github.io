// The shape of one row of content/jobs.csv, split into the two things a row actually
// describes: an employer and one of its open roles.

export interface Company {
  name: string;
  /** The state the employer is in — the board is national now. */
  state: string;
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
  anzscoUnitGroups: string[];
  anzscoUnitGroupTitles: string[];
  /** OSCA, the classification that replaced ANZSCO in December 2024. */
  oscaCodes: string[];
  oscaNames: string[];
  /**
   * The minimum score SkillSelect invited at, in the round most recently fetched, for this
   * role's matched occupation. Undefined when that occupation wasn't in it — not the same
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
  /** When the role was posted. Orders the board and drives the recency filter. */
  posted: string;
  applyUrl: string;
  company: Company;
}

/**
 * "Melbourne, Australia" — what the card, the detail page and the search
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
