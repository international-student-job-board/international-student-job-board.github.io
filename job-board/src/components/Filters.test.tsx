import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Filters, FilterOptions, FilterState } from './Filters';

const OPTIONS: FilterOptions = {
  companies: ['Acme', 'Zeta'],
  jobLocations: ['Melbourne, Victoria', 'Sydney, New South Wales'],
  jobStates: ['New South Wales', 'Victoria', ''],
  types: ['Full time', 'Internship', ''],
  employmentTypes: ['Full-time', 'Contract', ''],
  jobLevels: ['Graduate', 'Senior', ''],
  workArrangements: ['On-site', 'Remote', ''],
  educationLevels: ['Bachelor', 'Master', ''],
  industries: ['fintech', 'health'],
  companyTypes: ['saas', 'commission', ''],
  growthStages: ['early stage', 'breakout stage', 'late stage'],
  hqLocations: ['Melbourne, Victoria', 'Geelong, Victoria', ''],
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
  jobLocations: [],
  jobStates: [],
  types: [],
  employmentTypes: [],
  jobLevels: [],
  workArrangements: [],
  educationLevels: [],
  industries: [],
  companyTypes: [],
  growthStages: [],
  hqLocations: [],
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
};

function Harness() {
  const [filters, setFilters] = useState<FilterState>(EMPTY);
  return (
    <Filters
      filters={filters}
      options={OPTIONS}
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
const openModal = () => fireEvent.click(screen.getByRole('button', { name: /All filters/ }));
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
      /^Accredited sponsor/,
      /^Hires international students and graduates/,
      /^Job state/,
      /^Posted/,
      /^In the latest invitation round/,
      /^ANZSCO occupations/,
      /^Leads to visa/,
      /^Salary/,
    ].map((re) => order.findIndex((t) => re.test(t)));

    expect(seq.every((i) => i >= 0)).toBe(true);
    expect(seq).toEqual([...seq].sort((a, b) => a - b));

    expect(screen.getByRole('button', { name: /All filters/ })).toBeInTheDocument();
    // The rest are not on the bar.
    expect(
      screen.queryByRole('button', { name: /^Company$/, expanded: false })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Work arrangement/, expanded: false })
    ).not.toBeInTheDocument();
  });

  test('a bar filter narrows and chips', () => {
    render(<Harness />);
    openTrigger(/Accredited sponsor/);
    fireEvent.click(screen.getByRole('checkbox', { name: /Yes/ }));
    closeTrigger(/Accredited sponsor/);
    expect(screen.getByRole('button', { name: /Accredited sponsor.*Yes/ })).toBeInTheDocument();
  });

  test('the job state narrows and chips', () => {
    render(<Harness />);
    openTrigger(/^Job state/);
    fireEvent.click(screen.getByRole('checkbox', { name: /Victoria/ }));
    closeTrigger(/^Job state/);
    expect(screen.getByRole('button', { name: /Job state.*Victoria/ })).toBeInTheDocument();
  });
});

describe('the All filters modal', () => {
  test('opens with the same section headings, closes on Escape and on "Show N roles"', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    openModal();
    [
      'Visa and sponsorship',
      'Where',
      'When',
      'Salary',
      'The role',
      'The employer',
      'Occupation',
    ].forEach((s) =>
      expect(
        within(modal()).getByRole('heading', { name: new RegExp(`^${s}`) })
      ).toBeInTheDocument()
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
    fireEvent.click(
      within(modal()).getByRole('button', { name: /Work arrangement/, expanded: false })
    );
    // Both ticks land from the one open panel - it must not close after the first -
    // and the second is a click on the option's text label, not the box itself.
    fireEvent.click(screen.getByRole('checkbox', { name: /^Remote/ }));
    fireEvent.click(screen.getByText('On-site'));
    expect(screen.getByRole('checkbox', { name: /^Remote/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /^On-site/ })).toBeChecked();
    done();
    expect(screen.getByRole('button', { name: /Work arrangement.*Remote/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Work arrangement.*On-site/ })).toBeInTheDocument();
  });

  test('holds the bar filters too, and counts every filter set on its button', () => {
    render(<Harness />);
    openTrigger(/Accredited sponsor/);
    fireEvent.click(screen.getByRole('checkbox', { name: /Yes/ }));
    closeTrigger(/Accredited sponsor/);
    expect(screen.getByRole('button', { name: /All filters/ })).toHaveTextContent('1');

    openModal();
    [
      /^Posted/,
      /^Job state/,
      /^Hires international/,
      /^Accredited sponsor/,
      /^Leads to visa/,
    ].forEach((name) => expect(within(modal()).getByRole('button', { name })).toBeInTheDocument());
    // Salary is laid out in place in the dialog rather than as a popover.
    fireEvent.change(within(modal()).getByRole('combobox', { name: /min/i }), {
      target: { value: '100000' },
    });
    done();
    expect(screen.getByTitle('Salary: A$100k - Any')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /All filters/ })).toHaveTextContent('2');
  });

  test('"Clear all" empties bar and modal filters alike', () => {
    render(<Harness />);
    openTrigger(/Accredited sponsor/);
    fireEvent.click(screen.getByRole('checkbox', { name: /Yes/ }));
    closeTrigger(/Accredited sponsor/);

    openModal();
    fireEvent.click(within(modal()).getByRole('button', { name: /Job level/, expanded: false }));
    fireEvent.click(screen.getByRole('checkbox', { name: /^Senior/ }));
    fireEvent.click(within(modal()).getByRole('button', { name: /Clear all/ }));
    done();

    expect(
      screen.queryByRole('button', { name: /Accredited sponsor.*Yes/ })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Job level.*Senior/ })).not.toBeInTheDocument();
  });
});
