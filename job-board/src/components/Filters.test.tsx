import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Filters, FilterOptions, FilterState } from './Filters';

const OPTIONS: FilterOptions = {
  companies: ['Acme', 'Zeta'],
  states: ['Victoria', 'New South Wales'],
  types: ['Full time', 'Internship', ''],
  employmentTypes: ['Full-time', 'Contract', ''],
  jobLevels: ['Graduate', 'Senior', ''],
  workArrangements: ['On-site', 'Remote', ''],
  educationLevels: ['Bachelor', 'Master', ''],
  cities: ['Melbourne', 'Sydney'],
  industries: ['fintech', 'health'],
  companyTypes: ['saas', 'commission', ''],
  growthStages: ['early stage', 'breakout stage', 'late stage'],
  hqCities: ['Melbourne', 'Geelong', ''],
  anzscos: ['261313'],
  invitedOccupations: ['261313'],
  unitGroups: ['2613', '2241', ''],
  oscas: ['223233'],
  occupationLists: ['MLTSSL', 'CSOL', ''],
  pathwayVisas: ['186', '482'],
  sponsor: ['yes', ''],
  students: ['yes', ''],
};

const EMPTY: FilterState = {
  query: '',
  companies: [],
  states: [],
  types: [],
  employmentTypes: [],
  jobLevels: [],
  workArrangements: [],
  educationLevels: [],
  cities: [],
  industries: [],
  companyTypes: [],
  growthStages: [],
  hqCities: [],
  anzscos: [],
  invitedOccupations: [],
  unitGroups: [],
  oscas: [],
  occupationLists: [],
  pathwayVisas: [],
  sponsor: [],
  students: [],
  postedWithinDays: 0,
  salaryMin: 0,
  salaryMax: 0,
  minRating: 0,
};

const COUNTS = {
  minRating: new Map([
    ['3', 12],
    ['3.5', 8],
    ['4', 3],
    ['4.5', 1],
    ['-1', 30],
  ]),
};

function Harness() {
  const [filters, setFilters] = useState<FilterState>(EMPTY);
  return (
    <Filters
      filters={filters}
      options={OPTIONS}
      counts={COUNTS}
      resultCount={42}
      onChange={setFilters}
      onClear={() => setFilters(EMPTY)}
    />
  );
}

const trigger = (name: RegExp) => screen.getByRole('button', { name, expanded: false });
const openTrigger = (name: RegExp) => fireEvent.click(trigger(name));
const closeTrigger = (name: RegExp) =>
  fireEvent.click(screen.getByRole('button', { name, expanded: true }));
const openModal = () => fireEvent.click(screen.getByRole('button', { name: /More filters/ }));
const modal = () => screen.getByRole('dialog', { name: 'Filters' });
const done = () => fireEvent.click(screen.getByRole('button', { name: /Show \d+ roles?/ }));

describe('the filter bar', () => {
  test('carries the main filters, in order', () => {
    render(<Harness />);
    expect(screen.getByRole('searchbox', { name: /search jobs/i })).toBeInTheDocument();

    const order = screen
      .getAllByRole('button', { expanded: false })
      .map((b) => b.textContent ?? '');
    const seq = [
      /^Posted/,
      /^Hires international students and graduates/,
      /^Accredited sponsor/,
      /^In the latest invitation round/,
      /^ANZSCO occupations/,
      /^Leads to visa/,
      /^Salary/,
    ].map((re) => order.findIndex((t) => re.test(t)));

    expect(seq.every((i) => i >= 0)).toBe(true);
    expect(seq).toEqual([...seq].sort((a, b) => a - b));

    expect(screen.getByRole('button', { name: /More filters/ })).toBeInTheDocument();
    // The rest are not on the bar.
    expect(screen.queryByRole('button', { name: /^Company$/, expanded: false })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Work arrangement/, expanded: false })).not.toBeInTheDocument();
  });

  test('a bar filter narrows and chips', () => {
    render(<Harness />);
    openTrigger(/Accredited sponsor/);
    fireEvent.click(screen.getByRole('checkbox', { name: /Yes/ }));
    closeTrigger(/Accredited sponsor/);
    expect(screen.getByRole('button', { name: /Accredited sponsor.*Yes/ })).toBeInTheDocument();
  });

  test('ANZSCO occupations is a real dropdown on the bar', () => {
    render(<Harness />);
    openTrigger(/ANZSCO occupations/);
    fireEvent.click(screen.getByRole('checkbox', { name: /261313/ }));
    closeTrigger(/ANZSCO occupations/);
    expect(screen.getByRole('button', { name: /ANZSCO occupations.*261313/ })).toBeInTheDocument();
  });
});

describe('the More filters modal', () => {
  test('opens with the same section headings, closes on Escape and on "Show N roles"', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    openModal();
    ['Where', 'The role', 'The employer', 'Occupation and visa'].forEach((s) =>
      expect(within(modal()).getByRole('heading', { name: s })).toBeInTheDocument()
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    openModal();
    done();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('a modal filter takes several picks without reopening, then chips each', () => {
    render(<Harness />);
    openModal();
    fireEvent.click(within(modal()).getByRole('button', { name: /Work arrangement/, expanded: false }));
    // Both ticks land from the one open panel — it must not close after the first —
    // and the second is a click on the option's text label, not the box itself.
    fireEvent.click(screen.getByRole('checkbox', { name: /^Remote/ }));
    fireEvent.click(screen.getByText('On-site'));
    expect(screen.getByRole('checkbox', { name: /^Remote/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /^On-site/ })).toBeChecked();
    done();
    expect(screen.getByRole('button', { name: /Work arrangement.*Remote/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Work arrangement.*On-site/ })).toBeInTheDocument();
  });

  test('"Clear all" empties bar and modal filters alike', () => {
    render(<Harness />);
    openTrigger(/Accredited sponsor/);
    fireEvent.click(screen.getByRole('checkbox', { name: /Yes/ }));
    closeTrigger(/Accredited sponsor/);

    openModal();
    fireEvent.click(within(modal()).getByRole('button', { name: /Employer rating/, expanded: false }));
    fireEvent.click(screen.getByRole('radio', { name: /4\.0 and up/ }));
    fireEvent.click(within(modal()).getByRole('button', { name: /Clear all/ }));

    expect(screen.queryByRole('button', { name: /Accredited sponsor.*Yes/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Employer rating/, expanded: false })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Employer rating.*and up/ })).not.toBeInTheDocument();
  });
});

describe('the employer rating filter', () => {
  const openRating = () => {
    openModal();
    fireEvent.click(
      within(modal()).getByRole('button', { name: /Employer rating/, expanded: false })
    );
  };

  test('is single-choice and chips as "N and up"', () => {
    render(<Harness />);
    openRating();
    fireEvent.click(screen.getByRole('radio', { name: /3\.5 and up/ }));
    done();
    expect(screen.getByRole('button', { name: /Employer rating.*3.5 and up/ })).toBeInTheDocument();
  });

  test('each rung shows how many employers it would leave, and "Not specified" is an option', () => {
    render(<Harness />);
    openRating();
    const optionRow = (name: RegExp) =>
      screen.getByRole('radio', { name }).closest('label') as HTMLElement;
    expect(optionRow(/3\.0 and up/)).toHaveTextContent('12');
    expect(optionRow(/4\.0 and up/)).toHaveTextContent('3');
    expect(optionRow(/Not specified/)).toHaveTextContent('30');
  });

  test('"Not specified" chips on its own and clears', () => {
    render(<Harness />);
    openRating();
    fireEvent.click(screen.getByRole('radio', { name: /Not specified/ }));
    done();
    const chip = screen.getByRole('button', { name: /Employer rating.*Not specified/ });
    expect(chip).toBeInTheDocument();
    fireEvent.click(chip);
    expect(
      screen.queryByRole('button', { name: /Employer rating.*Not specified/ })
    ).not.toBeInTheDocument();
  });
});

describe('the salary range on the bar', () => {
  test('min is chosen with a plain select and it chips', () => {
    render(<Harness />);
    openTrigger(/^Salary/);
    fireEvent.change(screen.getByRole('combobox', { name: /min/i }), { target: { value: '100000' } });
    closeTrigger(/^Salary/);
    // The chip below the bar carries the chosen range.
    expect(screen.getByTitle('Salary: A$100k – Any')).toBeInTheDocument();
  });
});
