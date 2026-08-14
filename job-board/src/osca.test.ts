import {
  setOscaOccupations,
  resolveOsca,
  oscaUrl,
  oscaCodesFor,
  unitGroupFor,
  unitGroupCodesFor,
  unitGroupUrl,
  setUnitGroupTitles,
  unitGroupTitle,
} from './references';
import { Job } from './types';

const job = (over: Partial<Job> = {}): Job =>
  ({
    id: '1',
    title: 'Data Engineer',
    type: '',
    occupationNames: [],
    anzsco2022: [],
    anzsco2013: [],
    anzscoUnitGroup: '',
    anzscoUnitGroupTitle: '',
    oscaCodes: [],
    oscaNames: [],
    city: '',
    country: '',
    posted: '',
    applyUrl: '',
    company: {} as Job['company'],
    ...over,
  }) as Job;

beforeEach(() =>
  setOscaOccupations({
    '223233': { name: 'Data Engineer', unitGroup: 'ICT and Telecommunications Technicians' },
  })
);

describe('OSCA codes', () => {
  test('a code resolves to its name from the reference', () => {
    const [o] = resolveOsca(job({ oscaCodes: ['223233'], oscaNames: ['whatever the CSV said'] }));
    expect(o.name).toBe('Data Engineer');
  });

  test('a code the reference lacks falls back to the name in the CSV', () => {
    const [o] = resolveOsca(job({ oscaCodes: ['999999'], oscaNames: ['Odd Job'] }));
    expect(o.name).toBe('Odd Job');
    expect(o.code).toBe('999999');
  });

  test('the ABS page is built from the code, not stored', () => {
    // 223233 sits under 2 / 22 / 223 / 2232 — so 1,156 long URLs stay out of
    // the file the browser downloads.
    expect(oscaUrl('223233')).toMatch(/\/2\/22\/223\/2232\/223233$/);
  });

  test('anything that is not a six-digit code has no page', () => {
    expect(oscaUrl('2232')).toBeUndefined();
    expect(oscaUrl('')).toBeUndefined();
  });

  test('a role can carry more than one', () => {
    expect(oscaCodesFor(job({ oscaCodes: ['223233', '261313'] }))).toEqual(['223233', '261313']);
  });
});

describe('the ANZSCO unit group', () => {
  test('it is read from the column when the file gives one', () => {
    const group = unitGroupFor(
      job({ anzscoUnitGroup: '2241', anzscoUnitGroupTitle: 'Mathematical Science Professionals' })
    );
    expect(group).toEqual({ code: '2241', title: 'Mathematical Science Professionals' });
  });

  test('it is derived from a six-digit code when the column is blank', () => {
    // The first four digits of an ANZSCO code are its unit group, so a role
    // with a code always has one.
    expect(unitGroupFor(job({ anzsco2022: ['261313'] }))?.code).toBe('2613');
  });

  test('a role with neither cannot be placed', () => {
    expect(unitGroupFor(job())).toBeUndefined();
    expect(unitGroupCodesFor(job())).toEqual([]);
  });

  test('the unit group links to its own level of the ABS browser', () => {
    expect(unitGroupUrl('2613')).toMatch(/\/2\/26\/261\/2613$/);
    expect(unitGroupUrl('261313')).toBeUndefined();
  });
});

describe('how a code reads in a filter', () => {
  test('a unit-group title is registered from the jobs file and read back', () => {
    // Neither reference file carries four-digit titles — only the CSV does.
    setUnitGroupTitles({ '2613': 'Software and Applications Programmers' });
    expect(unitGroupTitle('2613')).toBe('Software and Applications Programmers');
    expect(unitGroupTitle('9999')).toBe('');
  });
});
