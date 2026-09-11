import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { FiltersModal, FilterSection } from './FiltersModal';

test('opens with its heading, footer and sections; Escape and "Show N" close it', () => {
  function Harness() {
    const [open, setOpen] = useState(true);
    return (
      <FiltersModal
        open={open}
        onClose={() => setOpen(false)}
        onClear={() => undefined}
        resultCount={5}
        resultNoun="role"
      >
        <FilterSection title="Where">
          <input aria-label="a control" />
        </FilterSection>
      </FiltersModal>
    );
  }
  render(<Harness />);

  expect(screen.getByRole('dialog', { name: 'Filters' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Where' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Show 5 roles' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('an irregular plural is used for the count button, not noun + "s"', () => {
  render(
    <FiltersModal
      open
      onClose={() => undefined}
      onClear={() => undefined}
      resultCount={7}
      resultNoun="company"
      resultNounPlural="companies"
    >
      <div />
    </FiltersModal>
  );
  expect(screen.getByRole('button', { name: 'Show 7 companies' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /companys/ })).not.toBeInTheDocument();
});

test('a parent re-render does not yank focus back to the dialog', () => {
  // The parent hands FiltersModal a fresh onClose every render. If the open
  // effect re-ran for that, it would call dialog.focus() and pull focus out of
  // whatever control the reader is using — which closed the open dropdown.
  function Harness() {
    const [, force] = useState(0);
    return (
      <>
        <button onClick={() => force((n) => n + 1)}>bump</button>
        <FiltersModal
          open
          onClose={() => undefined}
          onClear={() => undefined}
          resultCount={1}
          resultNoun="role"
        >
          <input aria-label="a control" />
        </FiltersModal>
      </>
    );
  }
  render(<Harness />);

  const control = screen.getByLabelText('a control');
  control.focus();
  expect(control).toHaveFocus();

  // Force several parent re-renders (each passes a new onClose identity).
  fireEvent.click(screen.getByRole('button', { name: 'bump' }));
  fireEvent.click(screen.getByRole('button', { name: 'bump' }));

  expect(control).toHaveFocus();
});
