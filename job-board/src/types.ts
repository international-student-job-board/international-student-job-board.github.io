export interface Job {
  id: string;
  title: string;
  company: string;
  companyAbout: string;
  companyUrl: string;
  location: string;
  jobLevel: string;
  type: string;
  arrangement: string;
  salary: string;
  salaryMinAnnual: number;
  salaryMaxAnnual: number;
  educationLevel: string;
  visaEligible: string[];
  visaPathways: string[];
  skillAssessment: string;
  /** One or more ANZSCO occupations; a role can map to several. */
  anzscos: string[];
  employerSponsored: boolean;
  posted: string;
  closes: string;
  skills: string[];
  summary: string;
  applyUrl: string;
}
