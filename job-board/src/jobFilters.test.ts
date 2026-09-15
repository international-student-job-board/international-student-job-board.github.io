import { computeFilterOptions, UNSPECIFIED } from './jobFilters';
import { setConstants } from './constants';
import { Job } from './types';

const job = (over: Partial<Job> = {}): Job =>
  ({
    id: '7',
    title: 'Senior Applied AI Engineer',
    type: 'Backend development',
    occupationNames: [],
    anzsco2022: [],
    anzsco2013: [],
    anzscoUnitGroups: [],
    anzscoUnitGroupTitles: [],
    oscaCodes: [],
    oscaNames: [],
    city: 'Melbourne',
    state: 'Victoria',
    country: 'Australia',
    posted: '2026-09-07',
    applyUrl: 'https://acme.test/apply',
    employmentType: '',
    jobLevel: '',
    workArrangement: '',
    educationLevels: [],
    salary: {
      base: { minAud: 120000, maxAud: 158000, currency: 'AUD' },
      source: 'advert',
      sourceUrl: '',
      isEstimate: false,
    },
    company: {
      name: 'Acme',
      state: 'Victoria',
      segment: '',
      types: [],
      industries: [],
      website: 'https://acme.test',
      growthStage: '',
      employees: '',
      hqCity: 'Melbourne',
      hqAddress: '',
      tagline: '',
      linkedin: '',
      openings: 1,
      accreditedSponsor: undefined,
      hiresInternationalStudents: undefined,
    },
    ...over,
  }) as Job;

beforeEach(() => {
  setConstants({
    jobLevel: ['Internship', 'Graduate', 'Junior', 'Mid', 'Senior', 'Lead'],
    type: [],
    arrangement: [],
    educationLevel: [
      'Diploma',
      'Certification',
      'Bachelor',
      'Final year of degree',
      'Master',
      'Graduate Diploma',
      'Graduate Certification',
      'PhD',
    ],
    assessment: [],
    skills: [],
  });
});

test('job level options follow the hierarchy in content/constants.json, not A-to-Z', () => {
  const jobs = [
    job({ id: '1', jobLevel: 'Senior' }),
    job({ id: '2', jobLevel: 'Junior' }),
    job({ id: '3', jobLevel: 'Internship' }),
    job({ id: '4', jobLevel: 'Lead' }),
  ];
  expect(computeFilterOptions(jobs).jobLevels).toEqual(['Internship', 'Junior', 'Senior', 'Lead']);
});

test('a job level the hierarchy does not name sorts after every known rung', () => {
  const jobs = [
    job({ id: '1', jobLevel: 'Senior' }),
    job({ id: '2', jobLevel: 'Contractor' }), // not in content/constants.json
    job({ id: '3', jobLevel: 'Internship' }),
  ];
  expect(computeFilterOptions(jobs).jobLevels).toEqual(['Internship', 'Senior', 'Contractor']);
});

test('education options follow the hierarchy, and roles with none sort last as unspecified', () => {
  const jobs = [
    job({ id: '1', educationLevels: ['PhD'] }),
    job({ id: '2', educationLevels: ['Bachelor'] }),
    job({ id: '3', educationLevels: [] }),
  ];
  expect(computeFilterOptions(jobs).educationLevels).toEqual(['Bachelor', 'PhD', UNSPECIFIED]);
});
