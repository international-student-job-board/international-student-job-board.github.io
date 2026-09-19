import { fireEvent, render, screen } from '@testing-library/react';
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
    jobLevels: [],
    workArrangements: [],
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

// A real <a href>, not a <button>, so right-click / middle-click / ctrl-click
// "open in new tab" all work like any other link on the web - see JobCard.tsx.
describe('opening a role', () => {
  test('is a real link to the role, not a fragment or a bare button', () => {
    render(<JobCard job={job()} selected={false} onSelect={() => undefined} />);
    expect(screen.getByRole('link', { name: /Senior Applied AI Engineer/ })).toHaveAttribute(
      'href',
      '/jobs/7'
    );
  });

  test('a plain left click selects the role in place, not a full navigation', () => {
    const onSelect = jest.fn();
    render(<JobCard job={job()} selected={false} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('link', { name: /Senior Applied AI Engineer/ }));
    expect(onSelect).toHaveBeenCalledWith('7');
  });

  test('a modified click (ctrl/cmd - opening in a new tab) is left to the browser', () => {
    const onSelect = jest.fn();
    render(<JobCard job={job()} selected={false} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('link', { name: /Senior Applied AI Engineer/ }), {
      ctrlKey: true,
    });
    expect(onSelect).not.toHaveBeenCalled();
  });
});
