// What the board starts on for a first-time visitor: where they are, and nothing else.

import { render, screen, waitFor } from '@testing-library/react';
import { COLUMNS } from './jobs';
import { toCsvRow } from './csv';
import App from './App';

const HEADER = COLUMNS.join(',');
const today = new Date().toISOString().slice(0, 10);

const role = (id: string, city: string, state: string) =>
  toCsvRow(
    {
      'Company name': `Company ${id}`,
      'Job title': `Role ${id}`,
      'Job ID': id,
      'Date posted': today,
      'Job city': city,
      'Job location city': city,
      'Job location state': state,
      // Everything the old defaults filtered on: sponsor, students that hire, and pay.
      'Accredited sponsor': id === '1' ? 'True' : 'False',
      'Hires international students': id === '1' ? 'True' : 'False',
    },
    [...COLUMNS]
  );

const BOARD = [
  HEADER,
  role('1', 'Melbourne', 'Victoria'),
  role('2', 'Melbourne', 'Victoria'),
  role('3', 'Sydney', 'New South Wales'),
].join('\n');

beforeEach(() => {
  (global as unknown as { fetch: jest.Mock }).fetch = jest.fn((url: string) =>
    String(url).includes('/jobs.csv')
      ? Promise.resolve({ ok: true, text: async () => BOARD })
      : Promise.resolve({ ok: false, status: 404, text: async () => '' })
  );
  // The reader's time zone says Melbourne.
  jest
    .spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions')
    .mockReturnValue({ timeZone: 'Australia/Melbourne' } as Intl.ResolvedDateTimeFormatOptions);
});

afterEach(() => {
  jest.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('a first visit', () => {
  test('starts on the reader’s own city and no other filter', async () => {
    render(<App />);
    // Both Melbourne roles - not only the one at a sponsor that hires students.
    expect(await screen.findByText('2 roles')).toBeInTheDocument();
    await waitFor(() => expect(window.location.search).toBe('?location=Melbourne%2C+Victoria'));
  });

  test('sponsor, students and pay are not switched on for them', async () => {
    render(<App />);
    await screen.findByText('2 roles');
    await waitFor(() => expect(window.location.search).not.toBe(''));
    const query = new URLSearchParams(window.location.search);
    expect(query.has('sponsor')).toBe(false);
    expect(query.has('students')).toBe(false);
    expect(query.has('salarymin')).toBe(false);
  });
});
