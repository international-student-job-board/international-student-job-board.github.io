// What a visitor sees while the whole board is still downloading.
//
// In its own file because the pre-loaded snapshot is memoised per module, so the first test to
// render App fixes it for the rest - a file of its own keeps that from leaking into the others.

import { render, screen, within } from '@testing-library/react';
import { COLUMNS } from './jobs';
import { toCsvRow } from './csv';
import App from './App';

const HEADER = COLUMNS.join(',');
const csv = (...rows: Record<string, string>[]) =>
  [HEADER, ...rows.map((r) => toCsvRow(r, [...COLUMNS]))].join('\n');

const role = (id: string, title: string) => ({
  'Company name': 'Acme',
  State: 'New South Wales',
  'Job title': title,
  'Job ID': id,
  'Job city': 'Sydney',
  'Job country': 'Australia',
  'Date posted': new Date().toISOString().slice(0, 10),
  'Accredited sponsor': 'True',
});

const SNAPSHOT = csv(role('1', 'Platform Engineer'), role('2', 'Product Designer'));

// The snapshot answers; the whole board never does - which is exactly the window under test.
// Installed per test, not once: CRA's jest config resets mock implementations between tests,
// which would leave a one-time mock answering every request with undefined.
beforeEach(() => {
  (global as unknown as { fetch: jest.Mock }).fetch = jest.fn((url: string) => {
    if (String(url).includes('recent-jobs.csv')) {
      return Promise.resolve({ ok: true, text: async () => SNAPSHOT });
    }
    return new Promise(() => undefined);
  });
});

// eslint-disable-next-line import/first
const at = (path: string) => window.history.replaceState(null, '', path);

afterEach(() => at('/'));

describe('the newest roles are on screen before the whole board has loaded', () => {
  test('the list shows them instead of placeholders, and says what it is showing', async () => {
    render(<App />);
    // Both are cards in the list. (The newest also fills the detail panel beside it, which is
    // why this asks for links rather than for the text, which would match twice.)
    expect(await screen.findByRole('link', { name: /platform engineer/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /product designer/i })).toBeInTheDocument();
    expect(screen.getByText(/the newest 2 roles, while the full board loads/i)).toBeInTheDocument();
    expect(screen.queryByText('Loading jobs')).not.toBeInTheDocument();
  });

  test('the board has one top-level heading, and it is the board’s own headline', async () => {
    render(<App />);
    await screen.findByText('Platform Engineer');
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent(/startup jobs in australia/i);
  });

  test('on a role’s own address the role’s title is the one heading', async () => {
    at('/jobs/2');
    render(<App />);
    await screen.findByText(/the newest 2 roles/i);
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent('Product Designer');
  });

  test("and nothing of the board's own intro sits above the role", async () => {
    at('/jobs/2');
    render(<App />);
    await screen.findByText(/the newest 2 roles/i);
    expect(screen.queryByText(/startup jobs in australia for international students/i)).toBeNull();
    expect(screen.queryByText(/open-sourced database of startups/i)).toBeNull();
    expect(screen.queryByRole('note', { name: /what's new/i })).toBeNull();
  });

  test('a link to a role the snapshot lacks waits for the board, not the wrong role', async () => {
    at('/jobs/999');
    render(<App />);
    // Placeholders, and none of the snapshot leaking in as if it were what was asked for.
    expect(await screen.findByText('Loading jobs')).toBeInTheDocument();
    expect(screen.queryByText('Platform Engineer')).not.toBeInTheDocument();
  });

  test('a link carrying filters is not answered with roles that ignore them', async () => {
    at('/?q=engineer');
    render(<App />);
    expect(await screen.findByText('Loading jobs')).toBeInTheDocument();
    expect(screen.queryByText('Platform Engineer')).not.toBeInTheDocument();
  });

  test('on a phone the filters start closed, so the roles are the first thing on the screen', async () => {
    const matchMedia = jest.fn((query: string) => ({
      matches: query.includes('max-width: 640px'),
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));
    Object.defineProperty(window, 'matchMedia', { value: matchMedia, configurable: true });
    try {
      render(<App />);
      await screen.findByRole('link', { name: /platform engineer/i });
      expect(screen.getByRole('button', { name: /^filters/i })).toHaveAttribute(
        'aria-expanded',
        'false'
      );
    } finally {
      // @ts-expect-error - putting jsdom back the way it was: it has no matchMedia at all.
      delete window.matchMedia;
    }
  });

  test('on a wide screen they start open, beside the list', async () => {
    render(<App />);
    await screen.findByRole('link', { name: /platform engineer/i });
    expect(screen.getByRole('button', { name: /^filters/i })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });

  test('the roles are real links to their own addresses', async () => {
    render(<App />);
    const list = await screen.findByRole('list');
    const link = within(list).getByRole('link', { name: /platform engineer/i });
    expect(link).toHaveAttribute('href', '/jobs/1');
  });
});
