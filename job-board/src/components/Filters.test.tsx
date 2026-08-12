import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Filters, FilterOptions, FilterState } from './Filters';

const OPTIONS: FilterOptions = {
  // The empty string is the "not specified" marker some roles land in.
  types: ['Full time', 'Internship', ''],
  levels: ['Graduate'],
  arrangements: ['Hybrid'],
  visas: ['485', '500'],
  pathwayVisas: ['186', '482'],
  anzscos: ['261313'],
  skillAssessments: ['ACS'],
  skills: ['React', 'Python'],
};

const EMPTY: FilterState = {
  query: '',
  types: [],
  levels: [],
  arrangements: [],
  visas: [],
  pathwayVisas: [],
  anzscos: [],
  skillAssessments: [],
  skills: [],
  salaryMin: 0,
  startsWithinDays: 0,
  postedWithinDays: 0,
  sponsoredOnly: false,
};

/** Holds the state the real page holds, so selections survive a re-render. */
function Harness() {
  const [filters, setFilters] = useState<FilterState>(EMPTY);
  return (
    <Filters
      filters={filters}
      options={OPTIONS}
      onChange={setFilters}
      onClear={() => setFilters(EMPTY)}
    />
  );
}

// The applied-filter chips carry the field name too, so triggers are matched on
// aria-expanded — only the dropdown triggers have it.
const openFilter = (name: RegExp) =>
  fireEvent.click(screen.getByRole('button', { name, expanded: false }));

const closeFilter = (name: RegExp) =>
  fireEvent.click(screen.getByRole('button', { name, expanded: true }));

const openTrigger = (name: RegExp) => screen.getByRole('button', { name, expanded: true });

test('a filter holds several values at once', () => {
  render(<Harness />);
  openFilter(/leads to visa/i);

  fireEvent.click(screen.getByRole('checkbox', { name: /186/ }));
  fireEvent.click(screen.getByRole('checkbox', { name: /482/ }));

  expect(screen.getByRole('checkbox', { name: /186/ })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: /482/ })).toBeChecked();
  expect(openTrigger(/leads to visa/i)).toHaveTextContent('2');
});

test('each selection gets a chip that removes only itself', () => {
  render(<Harness />);
  openFilter(/leads to visa/i);
  fireEvent.click(screen.getByRole('checkbox', { name: /186/ }));
  fireEvent.click(screen.getByRole('checkbox', { name: /482/ }));

  const chips = screen.getAllByRole('button', { name: /remove filter/i });
  expect(chips).toHaveLength(2);

  fireEvent.click(chips[0]);
  expect(screen.getAllByRole('button', { name: /remove filter/i })).toHaveLength(1);
});

test('selections in different filters stack up', () => {
  render(<Harness />);

  openFilter(/job type/i);
  fireEvent.click(screen.getByRole('checkbox', { name: /^Internship\b/ }));
  closeFilter(/job type/i);

  openFilter(/^skills$/i);
  fireEvent.click(screen.getByRole('checkbox', { name: /^React\b/ }));

  expect(screen.getAllByRole('button', { name: /remove filter/i })).toHaveLength(2);
  expect(screen.getByRole('button', { name: /clear all/i })).toHaveTextContent('2');
});

test('salary is single-choice — picking again replaces, never accumulates', () => {
  render(<Harness />);
  openFilter(/^salary/i);

  fireEvent.click(screen.getByRole('radio', { name: '$60k+' }));
  openFilter(/^salary/i);
  fireEvent.click(screen.getByRole('radio', { name: '$80k+' }));

  const chips = screen.getAllByRole('button', { name: /remove filter/i });
  expect(chips).toHaveLength(1);
  expect(chips[0]).toHaveTextContent('$80k+');
});

test('starts-within is single-choice too, and chips itself', () => {
  render(<Harness />);
  openFilter(/^starts/i);

  fireEvent.click(screen.getByRole('radio', { name: 'Within a month' }));
  openFilter(/^starts/i);
  fireEvent.click(screen.getByRole('radio', { name: 'Within 3 months' }));

  const chips = screen.getAllByRole('button', { name: /remove filter/i });
  expect(chips).toHaveLength(1);
  expect(chips[0]).toHaveTextContent('Within 3 months');

  fireEvent.click(chips[0]);
  expect(screen.queryByRole('button', { name: /remove filter/i })).not.toBeInTheDocument();
});

describe('roles that don’t say', () => {
  test('the blank option is labelled rather than an empty tick box', () => {
    render(<Harness />);
    openFilter(/job type/i);

    // Without a label this renders as a checkbox with no accessible name.
    expect(screen.getByRole('checkbox', { name: /^Not specified\b/ })).toBeInTheDocument();
  });

  test('choosing it chips as "Not specified", not as blank', () => {
    render(<Harness />);
    openFilter(/job type/i);
    fireEvent.click(screen.getByRole('checkbox', { name: /^Not specified\b/ }));

    expect(screen.getByRole('button', { name: /remove filter/i })).toHaveTextContent(
      'Not specified'
    );
  });

  test('salary offers it as a band and counts as an applied filter', () => {
    render(<Harness />);
    openFilter(/^salary/i);
    fireEvent.click(screen.getByRole('radio', { name: 'Not specified' }));

    const chips = screen.getAllByRole('button', { name: /remove filter/i });
    expect(chips).toHaveLength(1);
    expect(chips[0]).toHaveTextContent('Not specified');
  });
});

describe('the two date filters', () => {
  test('posted and starts are separate controls', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: /^posted/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^starts/i })).toBeInTheDocument();
  });

  test('posted looks back, in the windows a returning reader thinks in', () => {
    render(<Harness />);
    openFilter(/^posted/i);

    ['Last 24 hours', 'Last 2 days', 'Last 7 days', 'Last 14 days', 'Last month', 'Last 2 months']
      .forEach((label) =>
        expect(screen.getByRole('radio', { name: label })).toBeInTheDocument()
      );
  });

  test('each is single-choice and chips on its own', () => {
    render(<Harness />);
    openFilter(/^posted/i);
    fireEvent.click(screen.getByRole('radio', { name: 'Last 7 days' }));
    openFilter(/^starts/i);
    fireEvent.click(screen.getByRole('radio', { name: 'Within a month' }));

    const chips = screen.getAllByRole('button', { name: /remove filter/i });
    expect(chips).toHaveLength(2);
    expect(chips.map((c) => c.textContent).join(' ')).toMatch(/Last 7 days/);
    expect(chips.map((c) => c.textContent).join(' ')).toMatch(/Within a month/);
  });
});

describe('option counts', () => {
  const withCounts = () =>
    render(
      <Filters
        filters={EMPTY}
        options={OPTIONS}
        counts={
          {
            types: new Map([['Full time', 3], ['Internship', 1]]),
            levels: new Map(),
            arrangements: new Map(),
            visas: new Map(),
            pathwayVisas: new Map(),
            anzscos: new Map(),
            skillAssessments: new Map(),
            skills: new Map(),
          } as never
        }
        onChange={() => {}}
        onClear={() => {}}
      />
    );

  test('each option says how many roles it would leave', () => {
    withCounts();
    openFilter(/job type/i);

    expect(screen.getByRole('checkbox', { name: /^Full time\b/ })).toHaveAccessibleName(
      /3 results/
    );
    expect(screen.getByRole('checkbox', { name: /^Internship\b/ })).toHaveAccessibleName(
      /1 result\b/
    );
  });

  test('an option that would leave nothing reads as zero, not as blank', () => {
    withCounts();
    openFilter(/job type/i);
    // "Not specified" has no entry in the map at all.
    expect(screen.getByRole('checkbox', { name: /^Not specified\b/ })).toHaveAccessibleName(
      /0 results/
    );
  });
});
