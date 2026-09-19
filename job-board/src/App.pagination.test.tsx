// Paging through the real board: a page number is part of the address.

import { render, screen, within, fireEvent } from '@testing-library/react';
import { COLUMNS } from './jobs';
import { toCsvRow } from './csv';
import App from './App';

const HEADER = COLUMNS.join(',');
const today = new Date().toISOString().slice(0, 10);

// 25 roles: three pages of ten.
const BOARD = [
  HEADER,
  ...Array.from({ length: 25 }, (_, i) =>
    toCsvRow(
      {
        'Company name': `Company ${i}`,
        'Job title': `Role number ${i}`,
        'Job ID': String(1000 + i),
        'Date posted': today,
      },
      [...COLUMNS]
    )
  ),
].join('\n');

beforeEach(() => {
  (global as unknown as { fetch: jest.Mock }).fetch = jest.fn((url: string) =>
    String(url).includes('/jobs.csv')
      ? Promise.resolve({ ok: true, text: async () => BOARD })
      : Promise.resolve({ ok: false, status: 404, text: async () => '' })
  );
});

afterEach(() => window.history.replaceState(null, '', '/'));

const jobLinks = () =>
  screen.getAllByRole('link').filter((a) => (a.getAttribute('href') ?? '').startsWith('/jobs/'));

describe('the page number is in the address', () => {
  test('a link to page 2 opens page 2, and the board does not swap its default filters in under it', async () => {
    window.history.replaceState(null, '', '/?page=2');
    render(<App />);
    const nav = await screen.findByRole('navigation', { name: 'Job pages' });
    expect(within(nav).getByText('2', { selector: '[aria-current="page"]' })).toBeInTheDocument();
    // Ten roles on the page, not the first ten, and not a filtered subset of them.
    expect(jobLinks()).toHaveLength(10);
    expect(window.location.search).toBe('?page=2');
  });

  test('the last page holds what is left over', async () => {
    window.history.replaceState(null, '', '/?page=3');
    render(<App />);
    await screen.findByRole('navigation', { name: 'Job pages' });
    expect(jobLinks()).toHaveLength(5);
  });

  test('following Next moves the address along, and Prev returns to a clean one', async () => {
    window.history.replaceState(null, '', '/?page=2');
    render(<App />);
    const nav = await screen.findByRole('navigation', { name: 'Job pages' });

    fireEvent.click(within(nav).getByRole('link', { name: /next/i }));
    expect(window.location.search).toBe('?page=3');

    fireEvent.click(within(nav).getByRole('link', { name: /prev/i }));
    fireEvent.click(within(nav).getByRole('link', { name: /prev/i }));
    expect(window.location.search).toBe('');
  });

  test('a page past the end lands on the last page rather than an empty list', async () => {
    window.history.replaceState(null, '', '/?page=99');
    render(<App />);
    await screen.findByRole('navigation', { name: 'Job pages' });
    expect(jobLinks()).toHaveLength(5);
  });
});
