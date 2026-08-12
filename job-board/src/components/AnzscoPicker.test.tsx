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
      <AnzscoPicker id="occ" label="Occupations" value={value} onChange={setValue} />
      <output data-testid="value">{value.join(' | ')}</output>
    </>
  );
}

/** Opens the panel and waits for the list to arrive. */
const openPicker = async () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: /choose occupations/i }));
  await waitFor(() =>
    expect(screen.getByRole('checkbox', { name: /software engineer/i })).toBeInTheDocument()
  );
};

const tick = (name: RegExp) => fireEvent.click(screen.getByRole('checkbox', { name }));
const search = (text: string) =>
  fireEvent.change(screen.getByRole('textbox', { name: /search occupations/i }), {
    target: { value: text },
  });
const options = () =>
  within(screen.getByRole('group', { name: /occupations/i })).getAllByRole('checkbox');
const panelOpen = () => screen.queryByRole('group', { name: /occupations/i }) !== null;

beforeEach(() => {
  (global as unknown as { fetch: unknown }).fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, text: async () => TSV });
});

afterEach(() => {
  jest.resetAllMocks();
});

test('the panel lists every occupation as a tick box', async () => {
  await openPicker();
  expect(options()).toHaveLength(5);
});

test('ticking keeps the panel open, so several can be chosen in one pass', async () => {
  await openPicker();

  tick(/civil engineer/i);
  expect(panelOpen()).toBe(true);
  tick(/software engineer/i);
  expect(panelOpen()).toBe(true);

  expect(screen.getByTestId('value')).toHaveTextContent(
    '233211 Civil Engineer | 261313 Software Engineer'
  );
});

test('a ticked occupation can be unticked again', async () => {
  await openPicker();
  tick(/civil engineer/i);
  tick(/civil engineer/i);
  expect(screen.getByTestId('value')).toHaveTextContent('');
});

test('searching narrows the tick boxes', async () => {
  await openPicker();
  search('233');

  const shown = options();
  expect(shown).toHaveLength(3);
  shown.forEach((box) => expect(box.parentElement?.textContent).toMatch(/^233/));
});

test('the trigger reports how many are chosen', async () => {
  await openPicker();
  tick(/civil engineer/i);
  expect(screen.getByRole('button', { name: /1 chosen/i })).toBeInTheDocument();
});

test('an occupation off the list can be added deliberately', async () => {
  await openPicker();
  search('Underwater Basket Weaver');
  fireEvent.click(screen.getByRole('button', { name: /add .* as typed/i }));

  expect(screen.getByTestId('value')).toHaveTextContent('Underwater Basket Weaver');
});

test('escape closes the panel and leaves the choices alone', async () => {
  await openPicker();
  tick(/civil engineer/i);
  fireEvent.keyDown(document, { key: 'Escape' });

  expect(panelOpen()).toBe(false);
  expect(screen.getByTestId('value')).toHaveTextContent('233211 Civil Engineer');
});

test('chosen occupations can be removed from the chip list', async () => {
  await openPicker();
  tick(/civil engineer/i);
  fireEvent.keyDown(document, { key: 'Escape' });

  fireEvent.click(screen.getByRole('button', { name: /remove occupation/i }));
  expect(screen.getByTestId('value')).toHaveTextContent('');
});
