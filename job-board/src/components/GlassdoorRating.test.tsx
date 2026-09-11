import { render, screen } from '@testing-library/react';
import { GlassdoorRating } from './GlassdoorRating';
import { Company } from '../types';

const company = (over: Partial<Company> = {}): Company =>
  ({
    name: 'Acme',
    segment: '',
    types: [],
    industries: [],
    website: '',
    growthStage: '',
    employees: '',
    hqCity: '',
    hqAddress: '',
    tagline: '',
    linkedin: '',
    openings: 0,
    accreditedSponsor: undefined,
    hiresInternationalStudents: undefined,
    ...over,
  }) as Company;

test('the whole line is one link to Glassdoor, tagged as referral traffic', () => {
  render(
    <GlassdoorRating
      company={company({
        glassdoorRating: 4,
        glassdoorReviews: 36,
        glassdoorUrl: 'https://www.glassdoor.com.au/Overview/Working-at-Acme-EI_IE1.htm',
      })}
    />
  );
  const link = screen.getByRole('link');
  expect(link).toHaveTextContent('4.0 based on 36 reviews on Glassdoor');
  expect(link).toHaveAttribute('href', expect.stringContaining('glassdoor.com.au'));
  expect(link.getAttribute('href')).toMatch(/utm_campaign=glassdoor/);
  expect(link).toHaveAttribute('target', '_blank');
});

test('renders nothing without a rating', () => {
  const { container } = render(
    <GlassdoorRating company={company({ glassdoorUrl: 'https://www.glassdoor.com.au/x' })} />
  );
  expect(container).toBeEmptyDOMElement();
});

test('with a rating but no usable page link, shows the figure as plain text (no link)', () => {
  render(
    <GlassdoorRating
      company={company({ glassdoorRating: 3.2, glassdoorUrl: 'https://evil.test/gd' })}
    />
  );
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  expect(screen.getByText(/3\.2/)).toBeInTheDocument();
});
