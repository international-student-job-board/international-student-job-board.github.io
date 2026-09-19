import { fireEvent, render, screen } from '@testing-library/react';
import { WhatsNew } from './WhatsNew';

const UPDATES = [
  { date: '2026-09-19', text: 'Browse jobs by city.' },
  { date: '2026-09-11', text: 'Glassdoor ratings on every listing.' },
];

beforeEach(() => window.localStorage.clear());

describe('the what-is-new announcement', () => {
  test('announces the newest change, with its date', () => {
    render(<WhatsNew updates={UPDATES} today="2026-09-20" />);
    expect(screen.getByText(/browse jobs by city/i)).toBeInTheDocument();
    expect(screen.getByText(/19 Sept 2026/)).toBeInTheDocument();
    expect(screen.queryByText(/glassdoor/i)).not.toBeInTheDocument();
  });

  test('the earlier ones are one click behind it', () => {
    render(<WhatsNew updates={UPDATES} today="2026-09-20" />);
    fireEvent.click(screen.getByRole('button', { name: /earlier updates/i }));
    expect(screen.getByText(/glassdoor ratings on every listing/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /hide earlier updates/i }));
    expect(screen.queryByText(/glassdoor/i)).not.toBeInTheDocument();
  });

  test('dismissing hides it, and it stays hidden on the next visit', () => {
    const { unmount } = render(<WhatsNew updates={UPDATES} today="2026-09-20" />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByText(/browse jobs by city/i)).not.toBeInTheDocument();
    unmount();

    render(<WhatsNew updates={UPDATES} today="2026-09-21" />);
    expect(screen.queryByText(/browse jobs by city/i)).not.toBeInTheDocument();
  });

  test('a newer change is announced even to someone who dismissed the last one', () => {
    window.localStorage.setItem('whatsNewSeen', '2026-09-19');
    render(
      <WhatsNew
        updates={[{ date: '2026-09-25', text: 'Something newer.' }, ...UPDATES]}
        today="2026-09-26"
      />
    );
    expect(screen.getByText(/something newer/i)).toBeInTheDocument();
  });

  test('news retires itself after three weeks', () => {
    render(<WhatsNew updates={UPDATES} today="2026-10-11" />);
    expect(screen.queryByText(/browse jobs by city/i)).not.toBeInTheDocument();
  });

  test('still announced on day 21', () => {
    render(<WhatsNew updates={UPDATES} today="2026-10-10" />);
    expect(screen.getByText(/browse jobs by city/i)).toBeInTheDocument();
  });

  test('works when storage is blocked', () => {
    const blocked = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const setBlocked = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    try {
      render(<WhatsNew updates={UPDATES} today="2026-09-20" />);
      fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
      // Hidden for this visit even though it could not be remembered.
      expect(screen.queryByText(/browse jobs by city/i)).not.toBeInTheDocument();
    } finally {
      blocked.mockRestore();
      setBlocked.mockRestore();
    }
  });

  test('nothing when there is nothing to announce', () => {
    const { container } = render(<WhatsNew updates={[]} today="2026-09-20" />);
    expect(container).toBeEmptyDOMElement();
  });
});
