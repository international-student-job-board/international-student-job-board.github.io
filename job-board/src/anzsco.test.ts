import { parseAnzscoTsv, searchAnzsco, anzscoLabel } from './anzsco';

// Mirrors the real file, including its inconsistency: the header and the first
// data row separate the columns with spaces, the rest with a tab.
const TSV = [
  'Code    Title',
  '111111  Chief Executive or Managing Director',
  '261313\tSoftware Engineer',
  '261312\tDeveloper Programmer',
  '263111\tComputer Network and Systems Engineer',
  '233999\tEngineering Professionals nec',
  '',
].join('\n');

const rows = parseAnzscoTsv(TSV);

describe('parseAnzscoTsv', () => {
  test('reads rows separated by a tab or by spaces', () => {
    expect(rows).toHaveLength(5);
    expect(rows[0]).toEqual({ code: '111111', title: 'Chief Executive or Managing Director' });
    expect(rows[1]).toEqual({ code: '261313', title: 'Software Engineer' });
  });

  test('skips the header and any blank lines', () => {
    expect(rows.some((r) => r.title === 'Title')).toBe(false);
  });
});

describe('searchAnzsco', () => {
  test('an exact code wins', () => {
    expect(searchAnzsco(rows, '261313')[0].title).toBe('Software Engineer');
  });

  test('a partial code matches by prefix', () => {
    const codes = searchAnzsco(rows, '2613').map((r) => r.code);
    expect(codes).toEqual(['261312', '261313']);
  });

  test('searching by job name works for someone who has no idea of the code', () => {
    expect(searchAnzsco(rows, 'software')[0].code).toBe('261313');
  });

  test('a title that starts with the query outranks one that merely contains it', () => {
    const titles = searchAnzsco(rows, 'engineer').map((r) => r.title);
    expect(titles[0]).toBe('Engineering Professionals nec');
    expect(titles).toContain('Software Engineer');
  });

  test('no query lists everything, up to the limit', () => {
    expect(searchAnzsco(rows, '')).toHaveLength(5);
    expect(searchAnzsco(rows, '', 2)).toHaveLength(2);
  });

  test('a query matching nothing returns nothing rather than everything', () => {
    expect(searchAnzsco(rows, 'zzzz')).toEqual([]);
  });
});

test('the stored label carries both halves, so the code and name survive', () => {
  expect(anzscoLabel(rows[1])).toBe('261313 Software Engineer');
});
