import { fireEvent, render, screen } from '@testing-library/react';
import { FiltersDisclosure } from './FiltersDisclosure';

test('the filter section is closed first and the header opens and closes it', () => {
  render(
    <FiltersDisclosure activeCount={0}>
      <div data-testid="bar">the filter bar</div>
    </FiltersDisclosure>
  );

  const toggle = screen.getByRole('button', { name: /Filters/ });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByTestId('bar')).not.toBeInTheDocument();

  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByTestId('bar')).toBeInTheDocument();

  fireEvent.click(toggle);
  expect(screen.queryByTestId('bar')).not.toBeInTheDocument();
});

test('a count of active filters shows on the header even while closed', () => {
  render(
    <FiltersDisclosure activeCount={3}>
      <div>bar</div>
    </FiltersDisclosure>
  );
  expect(screen.getByRole('button', { name: /Filters/ })).toHaveTextContent('3');
});

test('defaultOpen renders the bar straight away', () => {
  render(
    <FiltersDisclosure activeCount={0} defaultOpen>
      <div data-testid="bar">bar</div>
    </FiltersDisclosure>
  );
  expect(screen.getByTestId('bar')).toBeInTheDocument();
});
