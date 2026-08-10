import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AnzscoPicker } from './AnzscoPicker';

const TSV = [
  'Code\tTitle',
  '111111\tChief Executive or Managing Director',
  '233211\tCivil Engineer',
  '233311\tElectrical Engineer',
  '233999\tEngineering Professionals nec',
  '261313\tSoftware Engineer',
].join('\n');

function Harness() {
  const [value, setValue] = useState<string[]>([]);
  return (
    <>
      <AnzscoPicker id="occ" label="Occupation" value={value} onChange={setValue} />
      <output data-testid="value">{value.join(' | ')}</output>
    </>
  );
}

const openPicker = async () => {
  render(<Harness />);
  const input = screen.getByRole('combobox', { name: 'Occupation' });
  fireEvent.focus(input);
  await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument());
  return input;
};

const optionTexts = () =>
  within(screen.getByRole('listbox'))
    .getAllByRole('option')
    .map((o) => o.textContent ?? '');

beforeEach(() => {
  (global as unknown as { fetch: unknown }).fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, text: async () => TSV });
});

afterEach(() => {
  jest.resetAllMocks();
});

test('focusing lists every occupation, so the list can be browsed', async () => {
  await openPicker();
  expect(optionTexts()).toHaveLength(5);
});

test('typing a code prefix narrows to it — the regression', async () => {
  const input = await openPicker();
  fireEvent.change(input, { target: { value: '233' } });

  const texts = optionTexts();
  expect(texts).toHaveLength(3);
  texts.forEach((t) => expect(t).toMatch(/^233/));
  expect(texts.join(' ')).not.toMatch(/Software Engineer/);
});

test('typing a job name narrows too', async () => {
  const input = await openPicker();
  fireEvent.change(input, { target: { value: 'civil' } });
  expect(optionTexts()).toEqual(['233211Civil Engineer']);
});

test('choosing an option stores the code and the title together', async () => {
  const input = await openPicker();
  fireEvent.change(input, { target: { value: '233211' } });
  fireEvent.click(screen.getByRole('option', { name: /civil engineer/i }));

  expect(screen.getByTestId('value')).toHaveTextContent('233211 Civil Engineer');
});

test('free text is kept when Enter is pressed on something that matches nothing', async () => {
  const input = await openPicker();
  fireEvent.change(input, { target: { value: 'underwater basket weaver' } });
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

  // Typing alone is a search; Enter is what commits, so an occupation that
  // isn't on the list can still be recorded.
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(screen.getByTestId('value')).toHaveTextContent('underwater basket weaver');
});

test('several occupations can be held at once', async () => {
  const input = await openPicker();

  fireEvent.change(input, { target: { value: 'civil' } });
  fireEvent.click(screen.getByRole('option', { name: /civil engineer/i }));
  fireEvent.change(input, { target: { value: 'software' } });
  fireEvent.click(screen.getByRole('option', { name: /software engineer/i }));

  expect(screen.getByTestId('value')).toHaveTextContent(
    '233211 Civil Engineer | 261313 Software Engineer'
  );
});

test('an occupation already chosen drops out of the list', async () => {
  const input = await openPicker();
  fireEvent.change(input, { target: { value: 'civil' } });
  fireEvent.click(screen.getByRole('option', { name: /civil engineer/i }));

  fireEvent.change(input, { target: { value: 'civil' } });
  expect(screen.queryByRole('option', { name: /civil engineer/i })).not.toBeInTheDocument();
});

test('a chosen occupation can be removed again', async () => {
  const input = await openPicker();
  fireEvent.change(input, { target: { value: 'civil' } });
  fireEvent.click(screen.getByRole('option', { name: /civil engineer/i }));

  fireEvent.click(screen.getByRole('button', { name: /remove occupation/i }));
  expect(screen.getByTestId('value')).toHaveTextContent('');
});
