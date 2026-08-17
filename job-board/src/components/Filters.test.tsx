import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Filters, FilterOptions, FilterState } from './Filters';

const OPTIONS: FilterOptions = {
  // The empty string is the "not specified" marker some roles land in.
  companies: ['Acme', 'Zeta'],
  states: ['Victoria', 'New South Wales'],
  types: ['Full time', 'Internship', ''],
  cities: ['Melbourne', 'Sydney'],
  industries: ['fintech', 'health'],
  companyTypes: ['saas', 'commission', ''],
  growthStages: ['early stage', 'breakout stage', 'late stage'],
  hqCities: ['Melbourne', 'Geelong', ''],
  anzscos: ['261313'],
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
  cities: [],
  industries: [],
  companyTypes: [],
  growthStages: [],
  hqCities: [],
  anzscos: [],
  unitGroups: [],
  oscas: [],
  occupationLists: [],
  pathwayVisas: [],
  sponsor: [],
  students: [],
  postedWithinDays: 0,
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

// The applied-filter chips carry the field name too, so triggers are matched on aria-
// expanded — only the dropdown triggers have it.
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
  closeFilter(/leads to visa/i);

  fireEvent.click(screen.getByRole('button', { name: /Leads to visa.*186/ }));

  expect(screen.queryByRole('button', { name: /Leads to visa.*186/ })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Leads to visa.*482/ })).toBeInTheDocument();
});

test('selections in different filters stack up', () => {
  render(<Harness />);

  openFilter(/job type/i);
  fireEvent.click(screen.getByRole('checkbox', { name: /Internship/ }));
  closeFilter(/job type/i);

  openFilter(/location/i);
  fireEvent.click(screen.getByRole('checkbox', { name: /Melbourne/ }));
  closeFilter(/location/i);

  expect(screen.getByRole('button', { name: /Clear all/ })).toHaveTextContent('2');
});

describe('roles that don’t say', () => {
  test('the blank option is labelled rather than an empty tick box', () => {
    render(<Harness />);
    openFilter(/job type/i);
    expect(screen.getByRole('checkbox', { name: /Not specified/ })).toBeInTheDocument();
  });

  test('choosing it chips as "Not specified", not as blank', () => {
    render(<Harness />);
    openFilter(/job type/i);
    fireEvent.click(screen.getByRole('checkbox', { name: /Not specified/ }));
    closeFilter(/job type/i);
    expect(screen.getByRole('button', { name: /Job type.*Not specified/ })).toBeInTheDocument();
  });
});

describe('the company’s own tags', () => {
  test('they filter separately from what the role does', () => {
    // "Job type" is what you would be doing; this is what the company is.
    render(<Harness />);
    openFilter(/job type/i);
    expect(screen.getByRole('checkbox', { name: /Full Time/ })).toBeInTheDocument();
    closeFilter(/job type/i);

    openFilter(/model & tech/i);
    expect(screen.getByRole('checkbox', { name: /SaaS/ })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Commission/ })).toBeInTheDocument();
  });

  test('a company with no tags is reachable as "Not specified"', () => {
    render(<Harness />);
    openFilter(/model & tech/i);
    fireEvent.click(screen.getByRole('checkbox', { name: /Not specified/ }));
    closeFilter(/model & tech/i);
    expect(
      screen.getByRole('button', { name: /Model & tech.*Not specified/ })
    ).toBeInTheDocument();
  });
});

describe('the occupation list filter', () => {
  test('each acronym is spelled out, since MLTSSL means nothing on its own', () => {
    render(<Harness />);
    openFilter(/occupation list/i);
    expect(
      screen.getByRole('checkbox', { name: /Medium and Long-term Strategic Skills List/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: /Core Skills Occupation List/ })
    ).toBeInTheDocument();
  });

  test('a role on no list is reachable, not hidden', () => {
    // Most roles carry no ANZSCO code at all, so most sit on no list.
    render(<Harness />);
    openFilter(/occupation list/i);
    expect(screen.getByRole('checkbox', { name: /Not specified/ })).toBeInTheDocument();
  });

  test('picking one chips under its own field name', () => {
    render(<Harness />);
    openFilter(/occupation list/i);
    fireEvent.click(screen.getByRole('checkbox', { name: /Core Skills Occupation List/ }));
    closeFilter(/occupation list/i);
    expect(screen.getByRole('button', { name: /Occupation list.*CSOL/ })).toBeInTheDocument();
  });
});

describe('the company filter', () => {
  test('names are offered as the source wrote them, not re-cased', () => {
    // Company names are proper nouns; capitalising them would invent brands that do not
    // exist.
    render(<Harness />);
    openFilter(/^Company/);
    expect(screen.getByRole('checkbox', { name: /Acme/ })).toBeInTheDocument();
  });

  test('picking one chips under its own field name', () => {
    render(<Harness />);
    openFilter(/^Company/);
    fireEvent.click(screen.getByRole('checkbox', { name: /Zeta/ }));
    closeFilter(/^Company/);
    expect(screen.getByRole('button', { name: /Company.*Zeta/ })).toBeInTheDocument();
  });
});

describe('stage and head office', () => {
  test('the stage stands alone, rather than paired with the segment', () => {
    // The detail page shows "startup · early stage" as one fact.
    render(<Harness />);
    openFilter(/^Stage/);
    // Capitalised on the way out — the source writes them lowercase.
    ['Early Stage', 'Breakout Stage', 'Late Stage'].forEach((label) =>
      expect(screen.getByRole('checkbox', { name: new RegExp(label) })).toBeInTheDocument()
    );
  });

  test('the head office is the company\u2019s, not the role\u2019s city', () => {
    // "Location" is where the job is; this is where the company is.
    render(<Harness />);
    openFilter(/head office/i);
    expect(screen.getByRole('checkbox', { name: /Geelong/ })).toBeInTheDocument();
    closeFilter(/head office/i);
    openFilter(/location/i);
    expect(screen.getByRole('checkbox', { name: /Sydney/ })).toBeInTheDocument();
  });

  test('both chip under their own field name', () => {
    render(<Harness />);
    openFilter(/^Stage/);
    fireEvent.click(screen.getByRole('checkbox', { name: /Late Stage/ }));
    closeFilter(/^Stage/);
    expect(screen.getByRole('button', { name: /Stage.*Late Stage/ })).toBeInTheDocument();
  });
});

describe('the two hand-checked answers', () => {
  test('they are separate controls, not one "sponsors visas?"', () => {
    // Accreditation is a formal status with the Department; hiring international students
    // is a hiring habit.
    render(<Harness />);
    expect(
      screen.getByRole('button', { name: /Accredited sponsor/, expanded: false })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Hires international students/, expanded: false })
    ).toBeInTheDocument();
  });

  test('each can be asked separately, and each chips under its own name', () => {
    render(<Harness />);
    openFilter(/Accredited sponsor/);
    fireEvent.click(screen.getByRole('checkbox', { name: /Yes/ }));
    closeFilter(/Accredited sponsor/);

    expect(screen.getByRole('button', { name: /Accredited sponsor.*Yes/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Clear all/ })).toHaveTextContent('1');
  });

  test('both at once narrows on both', () => {
    render(<Harness />);
    openFilter(/Accredited sponsor/);
    fireEvent.click(screen.getByRole('checkbox', { name: /Yes/ }));
    closeFilter(/Accredited sponsor/);
    openFilter(/Hires international students/);
    fireEvent.click(screen.getByRole('checkbox', { name: /Yes/ }));
    closeFilter(/Hires international students/);

    expect(screen.getByRole('button', { name: /Clear all/ })).toHaveTextContent('2');
  });

  test('an unchecked company is reachable, since blank never means "no"', () => {
    render(<Harness />);
    openFilter(/Hires international students/);
    expect(screen.getByRole('checkbox', { name: /Not checked yet/ })).toBeInTheDocument();
  });
});

describe('the recency filter', () => {
  test('looks back, in the windows a returning reader thinks in', () => {
    render(<Harness />);
    openFilter(/posted/i);
    ['Last 24 hours', 'Last 7 days', 'Last month'].forEach((label) =>
      expect(screen.getByRole('radio', { name: new RegExp(label) })).toBeInTheDocument()
    );
  });

  test('is single-choice — picking again replaces, never accumulates', () => {
    render(<Harness />);
    openFilter(/posted/i);
    fireEvent.click(screen.getByRole('radio', { name: /Last 7 days/ }));
    // A single-choice panel closes on its answer — there is nothing left to decide — so
    // asking again means opening it again.
    openFilter(/posted/i);
    fireEvent.click(screen.getByRole('radio', { name: /Last month/ }));

    expect(screen.getByRole('button', { name: /Posted.*Last month/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Posted.*Last 7 days/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Clear all/ })).toHaveTextContent('1');
  });
});

describe('option counts', () => {
  const COUNTS = {
    types: new Map([['Full time', 4], ['Internship', 0], ['', 2]]),
    pathwayVisas: new Map([['186', 3]]),
    sponsor: new Map([['yes', 5]]),
    postedWithinDays: new Map([['7', 6]]),
  };

  const withCounts = () =>
    render(
      <Filters
        filters={EMPTY}
        options={OPTIONS}
        counts={COUNTS}
        onChange={() => undefined}
        onClear={() => undefined}
      />
    );

  test('each option says how many roles it would leave', () => {
    withCounts();
    openFilter(/job type/i);
    expect(screen.getByRole('checkbox', { name: /Full Time.*4/ })).toBeInTheDocument();
  });

  test('an option that would leave nothing reads as zero, not as blank', () => {
    withCounts();
    openFilter(/job type/i);
    expect(screen.getByRole('checkbox', { name: /Internship.*0/ })).toBeInTheDocument();
  });

  test('the hand-checked answers are counted too', () => {
    withCounts();
    openFilter(/Accredited sponsor/);
    expect(screen.getByRole('checkbox', { name: /Yes.*5/ })).toBeInTheDocument();
  });

  test('the date windows count as well', () => {
    withCounts();
    openFilter(/posted/i);
    expect(screen.getByRole('radio', { name: /Last 7 days.*6/ })).toBeInTheDocument();
  });
});

describe('the state filter', () => {
  test('states are offered as the source writes them', () => {
    // The board is national now, so where a role is comes before what it is.
    render(<Harness />);
    openFilter(/^State/);
    expect(screen.getByRole('checkbox', { name: /Victoria/ })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /New South Wales/ })).toBeInTheDocument();
  });

  test('picking one chips under its own field name', () => {
    render(<Harness />);
    openFilter(/^State/);
    fireEvent.click(screen.getByRole('checkbox', { name: /Victoria/ }));
    closeFilter(/^State/);
    expect(screen.getByRole('button', { name: /State.*Victoria/ })).toBeInTheDocument();
  });
});
