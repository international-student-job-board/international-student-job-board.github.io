import { render, screen } from '@testing-library/react';
import { JobCard } from './JobCard';
import { Job } from '../types';

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

test('the card shows the AUD figure', () => {
  render(<JobCard job={job()} selected={false} onSelect={() => undefined} />);
  expect(screen.getByText(/A\$120k-A\$158k/)).toBeInTheDocument();
});
