import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the jobs panel heading', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /jobs/i })).toBeInTheDocument();
});
