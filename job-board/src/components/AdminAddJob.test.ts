import { buildJobRow } from './AdminAddJob';
import { emptyDraft, FIELDS, CHECKED_KEYS } from './jobFields';
import { COLUMNS } from '../jobs';
import { toCsvRow } from '../csv';

const draft = (over: Record<string, string> = {}) => ({ ...emptyDraft(), ...over });

const occupation = (name: string, anzsco2022: string, anzsco2013: string) => ({
  name,
  anzsco2022,
  anzsco2013,
});

describe('a filled form becomes a CSV row', () => {
  test('every column the form collects reaches the row', () => {
    // The bug this guards: a row built by walking some subset of the fields dropped
    // whatever the subset forgot, silently and per-field.
    const filled = Object.fromEntries(FIELDS.map((f) => [f.key, `v-${f.key}`]));
    const row = buildJobRow(draft(filled), []);
    FIELDS.filter((f) => !f.key.startsWith('ANZSCO') && !CHECKED_KEYS.includes(f.key)).forEach(
      (f) => expect(row[f.key]).toBe(`v-${f.key}`)
    );
  });

  test('values are trimmed on the way in', () => {
    expect(buildJobRow(draft({ 'Job title': '  Engineer  ' }), [])['Job title']).toBe('Engineer');
  });

  test('an untouched form claims nothing about the employer', () => {
    // "Not checked yet" is the default, and it has to reach the file as blank — otherwise
    // every role saved without touching the field asserts something about someone else's
    // standing with the Department.
    const row = buildJobRow(draft(), []);
    expect(row['Accredited sponsor']).toBe('');
    expect(row['Hires international students']).toBe('');
  });

  test('a real answer is saved as one, including "No"', () => {
    const row = buildJobRow(
      draft({ 'Accredited sponsor': 'Yes', 'Hires international students': 'No' }),
      []
    );
    expect(row['Accredited sponsor']).toBe('Yes');
    expect(row['Hires international students']).toBe('No');
  });
});

describe('the occupation columns', () => {
  test('one occupation writes its name and both codes', () => {
    const row = buildJobRow(draft(), [occupation('Software Engineer', '261313', '261313')]);
    expect(row['ANZSCO occupation']).toBe('Software Engineer');
    expect(row['ANZSCO 2022']).toBe('261313');
    expect(row['ANZSCO 2013']).toBe('261313');
  });

  test('several occupations are joined, keeping the columns in step', () => {
    const row = buildJobRow(draft(), [
      occupation('Software Engineer', '261313', '261313'),
      occupation('Data Analyst', '224114', '224999'),
    ]);
    expect(row['ANZSCO occupation']).toBe('Software Engineer; Data Analyst');
    expect(row['ANZSCO 2022']).toBe('261313; 224114');
    expect(row['ANZSCO 2013']).toBe('261313; 224999');
  });

  test('an occupation missing a code leaves that column short rather than blank-padded', () => {
    const row = buildJobRow(draft(), [occupation('Odd Job', '', '999999')]);
    expect(row['ANZSCO 2022']).toBe('');
    expect(row['ANZSCO 2013']).toBe('999999');
  });

  test('no occupation picked leaves all three empty', () => {
    const row = buildJobRow(draft(), []);
    expect(row['ANZSCO occupation']).toBe('');
    expect(row['ANZSCO 2022']).toBe('');
  });
});

describe('the row lands in the right columns', () => {
  test('written out, each value sits under its own header', () => {
    const row = buildJobRow(draft({ 'Job title': 'Engineer', 'Company name': 'Acme, Inc' }), []);
    const cells = toCsvRow(row, [...COLUMNS]).split(',');
    // "Acme, Inc" is quoted, so it is one cell containing a comma — splitting naively
    // proves the quoting happened at all.
    expect(cells).toHaveLength(COLUMNS.length + 1);
    expect(toCsvRow(row, [...COLUMNS])).toContain('"Acme, Inc"');
  });

  test('the form knows every column except the two it never fills in', () => {
    // 'Job ID' is assigned by the server; 'Invited Score' is derived upstream from the
    // ANZSCO occupation against the SkillSelect round, never typed or picked.
    const known = new Set(FIELDS.map((f) => f.key));
    const missing = COLUMNS.filter((c) => !known.has(c));
    expect(missing).toEqual(['Job ID', 'Invited Score']);
  });
});
