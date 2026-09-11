import { render, screen, within } from '@testing-library/react';
import { JobDetail } from './JobDetail';
import { setOccupations } from '../references';
import { Job, Salary } from '../types';

const emptySalary: Salary = { source: '', sourceUrl: '', isEstimate: false };

// No Testing Library query reaches a fact's containing .fact block from its label text alone.
const factFor = (label: string | RegExp): HTMLElement =>
  // eslint-disable-next-line testing-library/no-node-access
  screen.getByText(label).closest('.fact') as HTMLElement;

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
  expect(factFor('Employment type')).toHaveTextContent('Full-time');
  expect(factFor('Job level')).toHaveTextContent('Senior');
  expect(factFor('Work arrangement')).toHaveTextContent('On-site');
  // Salary was not enriched here.
  expect(factFor('Salary')).toHaveTextContent('Not specified');
  // No stray "Posted" fact in the nutshell (it's already in the header).
  expect(screen.queryByText('Posted')).not.toBeInTheDocument();
});

test('the Glassdoor rating shows only as an "Employer rating" fact, not by the company name', () => {
  const j = job();
  (j.company as { glassdoorRating?: number }).glassdoorRating = 4;
  (j.company as { glassdoorReviews?: number }).glassdoorReviews = 36;
  (j.company as { glassdoorUrl?: string }).glassdoorUrl =
    'https://www.glassdoor.com.au/Overview/Working-at-Acme-EI_IE1.htm';
  render(<JobDetail job={j} />);

  // The header no longer carries a rating line.
  // eslint-disable-next-line testing-library/no-node-access
  expect(screen.queryByText(/based on 36 reviews/)?.closest('.detail-head')).toBeFalsy();

  // The employer section has a labelled fact, its value linked, without "on Glassdoor".
  const fact = factFor('Employer rating');
  const factLink = within(fact).getByRole('link', { name: '4.0 based on 36 reviews' });
  expect(factLink).toHaveAttribute('href', expect.stringContaining('glassdoor'));
  expect(factLink).not.toHaveTextContent('on Glassdoor');
});

test('the Employer rating fact still shows, as "Not specified", when the company is not on Glassdoor', () => {
  render(<JobDetail job={job()} />);
  const fact = factFor('Employer rating');
  expect(fact).toHaveTextContent('Not specified');
  expect(within(fact).queryByRole('link')).not.toBeInTheDocument();
});

test('an estimated salary shows the AUD figure and links its source', () => {
  render(
    <JobDetail
      job={job({
        salary: {
          base: { minAud: 120000, maxAud: 157900, currency: 'AUD' },
          estimateAud: 145000,
          source: 'glassdoor',
          sourceUrl: 'https://www.glassdoor.com.au/Salary/Culture-Amp-Salaries-E742274.htm',
          isEstimate: true,
        },
      })}
    />
  );
  // The figure itself is the link - no "Glassdoor" label text beside it -
  // and it's marked an estimate with a leading "~".
  const link = screen.getByRole('link', { name: /A\$120k/ });
  expect(link).toHaveTextContent('~A$120k-A$158k');
  expect(link).toHaveAttribute('href', expect.stringContaining('glassdoor.com.au'));
  expect(link).toHaveAttribute('target', '_blank');
  // The "i" beside the label still names the source.
  expect(screen.getByLabelText('Salary source')).toBeInTheDocument();
});

test('a published salary carries no source note or link', () => {
  render(
    <JobDetail
      job={job({
        salary: {
          base: { minAud: 95000, maxAud: 110000, currency: 'AUD' },
          source: 'advert',
          sourceUrl: '',
          isEstimate: false,
        },
      })}
    />
  );
  const fact = factFor('Salary');
  expect(fact).toHaveTextContent('A$95k-A$110k');
  expect(fact).not.toHaveTextContent('~');
  expect(screen.queryByLabelText('Salary source')).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /glassdoor|levels/i })).not.toBeInTheDocument();
});

test('the salary is the plain AUD figure', () => {
  render(
    <JobDetail
      job={job({
        salary: {
          base: { minAud: 95000, maxAud: 110000, currency: 'AUD' },
          source: 'advert',
          sourceUrl: '',
          isEstimate: false,
        },
      })}
    />
  );
  const fact = factFor('Salary');
  expect(fact).toHaveTextContent('A$95k-A$110k');
  expect(screen.queryByLabelText('Salary source')).not.toBeInTheDocument();
});
