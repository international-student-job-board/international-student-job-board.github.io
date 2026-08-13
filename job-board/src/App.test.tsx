import { render, screen } from '@testing-library/react';
import App, { jobShareUrl } from './App';

test('renders the jobs panel heading', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /jobs/i })).toBeInTheDocument();
});

describe('a role has its own address', () => {
  const withHash = (hash: string) => {
    window.location.hash = hash;
  };

  afterEach(() => withHash(''));

  test('the share URL points at the role, absolutely', () => {
    const url = jobShareUrl('7');
    expect(url).toContain('#/jobs/7');
    expect(url.startsWith('http')).toBe(true);
  });

  test('an id needing escaping survives the round trip', () => {
    expect(jobShareUrl('a b/c')).toContain(encodeURIComponent('a b/c'));
  });
});
