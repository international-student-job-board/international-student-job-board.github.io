// What the board starts on for a first-time visitor: every role, with no filter switched on.

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
  test('shows every state - not only the one the reader’s time zone is in', async () => {
    render(<App />);
    // All three roles, Sydney's included, though the time zone says Melbourne.
    expect(await screen.findByText('Showing 1–3 of 3 roles')).toBeInTheDocument();
    await waitFor(() => expect(window.location.search).toBe(''));
  });

  test('sponsor, students and pay are not switched on for them', async () => {
    render(<App />);
    await screen.findByText('Showing 1–3 of 3 roles');
    const query = new URLSearchParams(window.location.search);
    expect(query.has('location')).toBe(false);
    expect(query.has('sponsor')).toBe(false);
    expect(query.has('students')).toBe(false);
    expect(query.has('salarymin')).toBe(false);
  });
});
