import { fireEvent, render, screen } from '@testing-library/react';
import { InfoTooltip } from './InfoTooltip';

test('a tap toggles the bubble open and shut, for touch screens with no hover', () => {
  render(<InfoTooltip text="What this means" />);
  const button = screen.getByRole('button', { name: 'More information' });
  expect(button).toHaveAttribute('aria-expanded', 'false');

  fireEvent.click(button);
  expect(button).toHaveAttribute('aria-expanded', 'true');

  fireEvent.click(button);
  expect(button).toHaveAttribute('aria-expanded', 'false');
});

test('a link passed in renders inside the bubble, clickable in its own right', () => {
  render(
    <InfoTooltip
      text="Checked against the official list."
      link={{ label: 'Official source', href: 'https://example.gov.au/list' }}
    />
  );
  const link = screen.getByRole('link', { name: 'Official source' });
  expect(link).toHaveAttribute('href', 'https://example.gov.au/list');
  expect(link).toHaveAttribute('target', '_blank');
});

test('with no link, the bubble carries text only', () => {
  render(<InfoTooltip text="Just an explanation." />);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

test('Escape closes a tapped-open bubble', () => {
  render(<InfoTooltip text="What this means" />);
  const button = screen.getByRole('button', { name: 'More information' });
  fireEvent.click(button);
  expect(button).toHaveAttribute('aria-expanded', 'true');

  fireEvent.keyDown(document, { key: 'Escape' });
  expect(button).toHaveAttribute('aria-expanded', 'false');
});

test('a pointerdown outside closes a tapped-open bubble', () => {
  render(<InfoTooltip text="What this means" />);
  const button = screen.getByRole('button', { name: 'More information' });
  fireEvent.click(button);
  expect(button).toHaveAttribute('aria-expanded', 'true');

  fireEvent.pointerDown(document.body);
  expect(button).toHaveAttribute('aria-expanded', 'false');
});
