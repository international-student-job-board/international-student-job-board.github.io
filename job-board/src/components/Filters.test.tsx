import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Filters, FilterOptions, FilterState } from './Filters';

const OPTIONS: FilterOptions = {
  types: ['Full time', 'Internship'],
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
  fireEvent.click(screen.getByRole('checkbox', { name: 'Internship' }));
  closeFilter(/job type/i);

  openFilter(/^skills$/i);
  fireEvent.click(screen.getByRole('checkbox', { name: 'React' }));

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

test('posted-within is single-choice too, and chips itself', () => {
  render(<Harness />);
  openFilter(/^posted/i);

  fireEvent.click(screen.getByRole('radio', { name: 'Past week' }));
  openFilter(/^posted/i);
  fireEvent.click(screen.getByRole('radio', { name: 'Past month' }));

  const chips = screen.getAllByRole('button', { name: /remove filter/i });
  expect(chips).toHaveLength(1);
  expect(chips[0]).toHaveTextContent('Past month');

  fireEvent.click(chips[0]);
  expect(screen.queryByRole('button', { name: /remove filter/i })).not.toBeInTheDocument();
});
