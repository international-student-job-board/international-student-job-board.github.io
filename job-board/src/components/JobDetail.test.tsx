import { render, screen } from '@testing-library/react';
import { JobDetail } from './JobDetail';
import { setOccupations } from '../references';
import { Job, Salary } from '../types';

const emptySalary: Salary = { isEstimate: false, levelsUrl: '' };

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
    salary: emptySalary,
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

beforeEach(() => setOccupations({}));

test('the working-conditions facts show what a role carries and "Not specified" otherwise', () => {
  render(
    <JobDetail
      job={job({
        employmentType: 'Full-time',
        jobLevel: 'Senior',
        workArrangement: 'On-site',
        educationLevels: ['Bachelor'],
      })}
    />
  );
  expect(screen.getByText('Employment type').closest('.fact')).toHaveTextContent('Full-time');
  expect(screen.getByText('Job level').closest('.fact')).toHaveTextContent('Senior');
  expect(screen.getByText('Work arrangement').closest('.fact')).toHaveTextContent('On-site');
  // Salary was not enriched here.
  expect(screen.getByText('Salary').closest('.fact')).toHaveTextContent('Not specified');
});

test('an estimated salary shows just the AUD figure, with the "i" source note', () => {
  render(
    <JobDetail
      job={job({
        salary: {
          base: { minAud: 142788, maxAud: 160727, currency: 'USD', min: 101268, max: 113991 },
          estimateAud: 106331,
          isEstimate: true,
          levelsUrl: 'https://www.levels.fyi/jobs?jobId=1',
        },
      })}
    />
  );
  const fact = screen.getByText('Salary').closest('.fact') as HTMLElement;
  expect(fact).toHaveTextContent('A$143k–A$161k');
  // No original-currency aside, no estimate tail, no inline link.
  expect(fact).not.toHaveTextContent('US$');
  expect(fact).not.toHaveTextContent('estimate');
  expect(screen.queryByRole('link', { name: /levels\.fyi/i })).not.toBeInTheDocument();
  expect(screen.getByLabelText('Salary source')).toBeInTheDocument();
});

test('a published salary carries no source note', () => {
  render(
    <JobDetail
      job={job({
        salary: {
          base: { minAud: 95000, maxAud: 110000, currency: 'AUD' },
          isEstimate: false,
          levelsUrl: '',
        },
      })}
    />
  );
  const fact = screen.getByText('Salary').closest('.fact') as HTMLElement;
  expect(fact).toHaveTextContent('A$95k–A$110k');
  expect(screen.queryByLabelText('Salary source')).not.toBeInTheDocument();
});
