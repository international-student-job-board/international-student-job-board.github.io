// The Add-a-job field definitions, shared by the public form (PostJob) and the local admin
// (AdminAddJob).
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

/** "Not checked yet" leads, and so is the default a blank form starts on. */
const CHECKED = ['Not checked yet', 'Yes', 'No'];

export const FIELDS: Field[] = [
  // ---- The role ----------------------------------------------------------
  {
    key: 'Job title',
    label: 'Job title',
    type: 'text',
    required: true,
    placeholder: 'Graduate Software Engineer',
  },
  { key: 'Job type', label: 'Job type', type: 'select', options: getConstant('type') },
  {
    key: 'Employment type',
    label: 'Employment type',
    type: 'select',
    options: ['', ...getConstant('type')],
  },
  {
    key: 'Job level',
    label: 'Job level',
    type: 'select',
    options: ['', ...getConstant('jobLevel')],
  },
  {
    key: 'Work arrangement',
    label: 'Work arrangement',
    type: 'select',
    options: ['', ...getConstant('arrangement')],
  },
  {
    key: 'Education level',
    label: 'Education level',
    type: 'text',
    placeholder: 'Bachelor; Master',
    hint: 'Degrees the ad asks for. Separate with semicolons.',
  },
  { key: 'Base salary min', label: 'Base salary min', type: 'text', placeholder: '90000' },
  { key: 'Base salary max', label: 'Base salary max', type: 'text', placeholder: '110000' },
  { key: 'Base salary currency', label: 'Base salary currency', type: 'text', placeholder: 'AUD' },
  {
    key: 'Base salary min AUD',
    label: 'Base salary min (AUD)',
    type: 'text',
    placeholder: '90000',
  },
  {
    key: 'Base salary max AUD',
    label: 'Base salary max (AUD)',
    type: 'text',
    placeholder: '110000',
  },
  {
    key: 'Company salary estimate AUD',
    label: 'Company salary estimate (AUD)',
    type: 'text',
    placeholder: '105000',
  },
  {
    key: 'Salary source',
    label: 'Salary source',
    type: 'select',
    options: ['', 'advert', 'glassdoor', 'levels.fyi'],
    hint: '"advert" if the employer stated it; "glassdoor"/"levels.fyi" if it is an estimate.',
  },
  {
    key: 'Salary source URL',
    label: 'Salary source URL',
    type: 'url',
    placeholder: 'https://www.glassdoor.com.au/Salary/…',
    hint: 'The page to link to for a Glassdoor / levels.fyi figure.',
  },
  { key: 'Job city', label: 'City', type: 'text', placeholder: 'Melbourne' },
  { key: 'Job country', label: 'Country', type: 'text', placeholder: 'Australia' },
  {
    key: 'Job URL',
    label: 'Application link or email',
    type: 'url',
    required: true,
    placeholder: 'https://www.acme.com/careers',
    hint: 'Careers page or job-board link, or an email link (mailto:jobs@acme.com) if you take applications by email.',
  },
  {
    key: 'Date posted',
    label: 'Date posted',
    type: 'date',
    hint: 'Orders the board and drives the "posted recently" filter. Defaults to today.',
  },
  // The three occupation columns are written by the picker rather than typed, so they carry
  // no input of their own - see AdminAddJob.
  { key: 'ANZSCO occupation', label: 'ANZSCO occupation', type: 'text' },
  { key: 'ANZSCO 2022', label: 'ANZSCO 2022', type: 'text' },
  { key: 'ANZSCO 2013', label: 'ANZSCO 2013', type: 'text' },
  // The unit group is filled from the picked code; the rest are typed.
  { key: 'ANZSCO unit group', label: 'ANZSCO unit group', type: 'text' },
  {
    key: 'ANZSCO unit group title',
    label: 'Unit group title',
    type: 'text',
    placeholder: 'Software and Applications Programmers',
    hint: 'Used when a role cannot be matched to a single six-digit occupation.',
  },
  { key: 'OSCA occupation', label: 'OSCA occupation', type: 'text', placeholder: 'Data Engineer' },
  { key: 'OSCA code', label: 'OSCA code', type: 'text', placeholder: '223233' },

  // ---- The employer ------------------------------------------------------
  { key: 'Company name', label: 'Company name', type: 'text', required: true, placeholder: 'Acme' },
  { key: 'State', label: 'State', type: 'text', placeholder: 'Victoria' },
  {
    key: 'Tagline',
    label: 'Tagline',
    type: 'textarea',
    maxLength: 300,
    placeholder: 'The company’s own one-liner.',
  },
  { key: 'Website', label: 'Website', type: 'url', placeholder: 'https://www.acme.com' },
  {
    key: 'LinkedIn',
    label: 'LinkedIn',
    type: 'url',
    placeholder: 'https://www.linkedin.com/company/acme',
  },
  { key: 'Segment', label: 'Segment', type: 'text', placeholder: 'startup' },
  {
    key: 'Type',
    label: 'Builds',
    type: 'text',
    placeholder: 'saas; machine learning',
    hint: 'Separate with semicolons.',
  },
  {
    key: 'Industries',
    label: 'Industries',
    type: 'text',
    placeholder: 'fintech; health',
    hint: 'Separate with semicolons.',
  },
  { key: 'Growth stage', label: 'Growth stage', type: 'text', placeholder: 'early growth' },
  { key: 'Employees', label: 'Employees', type: 'text', placeholder: '101-250' },
  { key: 'HQ city', label: 'HQ city', type: 'text', placeholder: 'Melbourne' },
  { key: 'HQ address', label: 'HQ address', type: 'text', placeholder: 'Cremorne VIC 3121' },
  {
    key: 'Job openings',
    label: 'Job openings',
    type: 'text',
    hint: 'How many roles the company says it has open.',
  },
  { key: 'Accredited sponsor', label: 'Accredited sponsor?', type: 'select', options: CHECKED },
  {
    key: 'Hires international students',
    label: 'Hires international students and graduates?',
    type: 'select',
    options: CHECKED,
    hint: 'Leave as "Not checked yet" unless you know. It shows on the listing either way.',
  },
];

/** Rendered in these groups, in this order; anything left over goes last. */
export const FIELD_GROUPS: { title: string; keys: string[] }[] = [
  {
    title: 'The role',
    keys: [
      'Job title',
      'Job type',
      'Employment type',
      'Job level',
      'Work arrangement',
      'Education level',
      'Job city',
      'Job country',
      'Job URL',
      'Date posted',
    ],
  },
  {
    title: 'Salary',
    keys: [
      'Base salary min',
      'Base salary max',
      'Base salary currency',
      'Base salary min AUD',
      'Base salary max AUD',
      'Company salary estimate AUD',
      'Salary source',
      'Salary source URL',
    ],
  },
  {
    title: 'Occupation codes',
    keys: ['ANZSCO unit group title', 'OSCA occupation', 'OSCA code'],
  },
  {
    title: 'The employer',
    keys: [
      'Company name',
      'State',
      'Tagline',
      'Website',
      'LinkedIn',
      'Segment',
      'Type',
      'Industries',
      'Growth stage',
      'Employees',
      'HQ city',
      'HQ address',
      'Job openings',
      'Accredited sponsor',
      'Hires international students',
    ],
  },
];

/** Written by the occupation picker, not by an input of their own. */
export const OCCUPATION_KEYS = [
  'ANZSCO occupation',
  'ANZSCO 2022',
  'ANZSCO 2013',
  'ANZSCO unit group',
];

/** The yes/no columns, whose "Not checked yet" answer is saved as an empty cell. */
export const CHECKED_KEYS = ['Accredited sponsor', 'Hires international students'];

export type Draft = Record<string, string>;

export const emptyDraft = (): Draft =>
  FIELDS.reduce((acc, f) => {
    acc[f.key] = f.type === 'select' && f.options ? f.options[0] : '';
    return acc;
  }, {} as Draft);
