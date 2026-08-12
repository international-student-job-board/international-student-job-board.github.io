export interface Job {
  id: string;
  title: string;
  company: string;
  companyAbout: string;
  companyUrl: string;
  location: string;
  jobLevel: string;
  type: string;
  /** On-site, Hybrid, Remote — a role often offers more than one. */
  arrangements: string[];
  salary: string;
  salaryMinAnnual: number;
  salaryMaxAnnual: number;
  educationLevel: string;
  visaEligible: string[];
  visaPathways: string[];
  skillAssessment: string;
  /** One or more ANZSCO occupations; a role can map to several. */
  anzscos: string[];
  /**
   * Whether the employer sponsors visas: true, false, or undefined when the
   * listing never said. Blank and "no" are different answers — one is a
   * decision, the other is a gap — and collapsing them told readers a role
   * had been ruled out when nobody had ruled anything.
   */
  employerSponsored: boolean | undefined;
  /**
   * Whether the poster asked for their details to appear on the listing. False
   * by default: publishing a person's name is something they opt into, not
   * something they have to notice and switch off.
   */
  contactPublic: boolean;
  /**
   * Whoever posted the role. The name, position and LinkedIn are shown only
   * when contactPublic is set; the email and website are never shown at all.
   */
  contactName: string;
  contactPosition: string;
  contactLinkedin: string;
  contactWebsite: string;
  contactEmail: string;
  /** When we listed the role. Internal: it orders the board, and isn't shown. */
  posted: string;
  /** When the role itself starts. This is the date students care about. */
  startDate: string;
  closes: string;
  skills: string[];
  summary: string;
  applyUrl: string;
}
