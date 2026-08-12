// The Post-a-job field definitions, shared by the public form (PostJob) and the
// local admin (AdminAddJob). Kept in its own module so AdminAddJob doesn't have
// to import from PostJob (which imports AdminAddJob) - that cycle put FIELDS in
// its temporal dead zone at load time.
import { getConstant } from '../constants';

export type FieldType = 'text' | 'url' | 'date' | 'textarea' | 'select';

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  hint?: string;
  maxLength?: number;
}

export const FIELDS: Field[] = [
  { key: 'title', label: 'Job title', type: 'text', required: true, placeholder: 'Graduate Software Engineer' },
  { key: 'company', label: 'Company name', type: 'text', required: true, placeholder: 'Acme' },
  { key: 'company_about', label: 'About the company', type: 'textarea', maxLength: 300, placeholder: 'What the company does. Up to about 300 characters.' },
  { key: 'company_url', label: 'Company link', type: 'url', placeholder: 'https://www.acme.com' },
  { key: 'apply_url', label: 'Application link or email', type: 'url', required: true, placeholder: 'https://www.acme.com/careers', hint: 'Careers page or job-board link, or an email link (mailto:jobs@acme.com) if you take applications by email.' },
  { key: 'job_level', label: 'Level', type: 'select', options: getConstant('jobLevel') },
  { key: 'type', label: 'Type', type: 'select', options: getConstant('type') },
  { key: 'arrangement', label: 'Work arrangement', type: 'select', options: getConstant('arrangement') },
  { key: 'location', label: 'Location', type: 'text', placeholder: 'Richmond, Melbourne VIC' },
  { key: 'salary', label: 'Salary or pay range', type: 'text', placeholder: '$85,000-$95,000', hint: 'Optional : : left blank it shows as "Not specified".' },
  { key: 'start_date', label: 'Role start date', type: 'date', required: true, hint: 'When the successful applicant would start.' },
  { key: 'closes', label: 'Application closes', type: 'date', hint: 'The role drops off the board the day after this.' },
  { key: 'education_level', label: 'Education needed', type: 'select', options: getConstant('educationLevel') },
  { key: 'summary', label: 'Summary of the role', type: 'textarea', placeholder: 'What the person will do day to day. Add as much as you like.' },
  { key: 'skills', label: 'Skills needed', type: 'text', placeholder: 'Software, Backend, Python, React', hint: 'Separate with commas.' },
  { key: 'visa_eligible', label: 'Visa(s) a candidate can apply on', type: 'text', placeholder: '485, 500', hint: 'Optional : : Leave blank if unsure. Separate with commas.' },
  { key: 'visa_pathways', label: 'Visa(s) this role can lead to', type: 'text', placeholder: '189, 190, 186', hint: 'Optional : : Separate with commas.' },
  { key: 'skill_assessment', label: 'Skills assessing authority', type: 'text', placeholder: 'ACS', hint: 'Optional : : e.g. ACS, Engineers Australia, VETASSESS.' },
  { key: 'anzsco', label: 'ANZSCO occupation & code', type: 'text', placeholder: '261313 Software Engineer', hint: 'The 6-digit code and occupation name. Both forms collect this with the occupation picker rather than as free text.' },
  { key: 'employer_sponsored', label: 'Offer employer-sponsored visas?', type: 'select', options: ['Yes', 'No'] },
  { key: 'contact_public', label: 'Show your details on the listing?', type: 'select', options: ['No', 'Yes'], hint: 'Yes puts your name, position and LinkedIn on the job post so students know who they would be writing to.' },
  { key: 'contact_name', label: 'Your name', type: 'text', placeholder: 'Alex Nguyen', hint: 'Shown only if you said yes above.' },
  { key: 'contact_position', label: 'Your position', type: 'text', placeholder: 'Head of Engineering', hint: 'Shown only if you said yes above.' },
  { key: 'contact_linkedin', label: 'Your LinkedIn', type: 'url', placeholder: 'https://www.linkedin.com/in/…', hint: 'Shown only if you said yes above.' },
  { key: 'contact_website', label: 'Your website', type: 'url', placeholder: 'https://www.acme.com/team/alex', hint: 'Not published : : so we can check who you are.' },
  { key: 'contact_email', label: 'Your email', type: 'text', placeholder: 'alex@acme.com', hint: 'Not published : : so we can come back to you about the role.' },
];

export type Draft = Record<string, string>;

export const emptyDraft = (): Draft =>
  FIELDS.reduce((acc, f) => {
    acc[f.key] = f.type === 'select' && f.options ? f.options[0] : '';
    return acc;
  }, {} as Draft);

// Fields that hold pipe-separated lists in jobs.json (the form takes commas).
export const LIST_KEYS = ['visa_eligible', 'visa_pathways', 'skills', 'arrangement'];
