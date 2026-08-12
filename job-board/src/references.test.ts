import {
  pathwayVisasFor,
  resolveOccupation,
  resolveOccupations,
  occupationCodesFor,
  assessmentsFor,
} from './references';
import { Job } from './types';

/**
 * The reference file is stood in for, rather than read.
 *
 * These tests used to assert against whatever occupations.json happened to
 * contain, so emptying or editing that file — a normal thing to do while
 * curating — broke seven of them. What is being tested here is how a code is
 * resolved, not which occupations we have got round to writing up.
 */
jest.mock('./data/occupations.json', () => ({
  '261313': {
    name: 'Software Engineer',
    anzscoUrl: 'https://abs.example/2/26/261/2613',
    assessment: 'ACS',
    assessmentUrl: 'https://acs.example',
    lists: ['MLTSSL', 'CSOL'],
    visas: [
      { code: '189', name: 'Skilled Independent' },
      { code: '190', name: 'Skilled Nominated' },
      { code: '186', name: 'Employer Nomination Scheme' },
      { code: '482', name: 'Skills in Demand' },
      { code: '485', name: 'Temporary Graduate' },
      { code: '491', name: 'Skilled Work Regional' },
      // Listed twice for different streams, exactly as the real file does.
      { code: '491', name: 'Skilled Work Regional (Family)' },
    ],
  },
  '233999': {
    name: 'Engineering Professionals nec',
    anzscoUrl: 'https://abs.example/2/23/233/2339',
    assessment: 'Engineers Australia',
    assessmentUrl: 'https://ea.example',
    lists: ['MLTSSL', 'CSOL'],
    visas: [
      { code: '189', name: 'Skilled Independent' },
      { code: '190', name: 'Skilled Nominated' },
      { code: '186', name: 'Employer Nomination Scheme' },
      { code: '482', name: 'Skills in Demand' },
    ],
  },
}));

// A job carrying one occupation, unless a test says otherwise.
const job = (over: Partial<Job> = {}): Job =>
  ({
    anzscos: ['261313'],
    skillAssessment: '',
    visaPathways: ['189', '190', '186'],
    ...over,
  } as Job);

test('pathways include the visas the occupation opens up, not just the job', () => {
  const pathways = pathwayVisasFor(job());
  const fromOccupation = resolveOccupation('261313', '').visas.map((v) => v.code);

  // The regression: the job names three, the occupation opens up more, and
  // every one of them has to be filterable.
  expect(job().visaPathways.length).toBeLessThan(pathways.length);
  fromOccupation.forEach((code) => expect(pathways).toContain(code));
});

test('the job’s own pathways survive even when the occupation is unknown', () => {
  const pathways = pathwayVisasFor(job({ anzscos: ['999999'] }));
  expect(pathways).toEqual(['189', '190', '186']);
});

test('a role mapped to two occupations pools the visas of both', () => {
  const one = pathwayVisasFor(job({ anzscos: ['261313'], visaPathways: [] }));
  const both = pathwayVisasFor(job({ anzscos: ['261313', '233999'], visaPathways: [] }));

  // Both occupations resolve, and nothing is counted twice where they overlap.
  expect(both.length).toBeGreaterThanOrEqual(one.length);
  expect(new Set(both).size).toBe(both.length);
});

test('every occupation a role maps to is reported, in order', () => {
  expect(occupationCodesFor(job({ anzscos: ['261313', '233999'] }))).toEqual([
    '261313',
    '233999',
  ]);
});

test('assessors are pooled across occupations and deduplicated', () => {
  const assessors = assessmentsFor(job({ anzscos: ['261313', '233999'] }));
  expect(new Set(assessors).size).toBe(assessors.length);
});

test('a subclass listed by both the job and the occupation appears once', () => {
  const pathways = pathwayVisasFor(job());
  expect(new Set(pathways).size).toBe(pathways.length);
  expect(pathways.filter((c) => c === '189')).toHaveLength(1);
});

test('a role with no pathways of its own still inherits the occupation’s', () => {
  const pathways = pathwayVisasFor(job({ visaPathways: [] }));
  expect(pathways.length).toBeGreaterThan(0);
  expect(pathways).toContain('482');
});

describe('naming an occupation', () => {
  test('a code we have written up gets its proper name', () => {
    const occ = resolveOccupation('261313', '');
    expect(occ.code).toBe('261313');
    expect(occ.name).toBe('Software Engineer');
  });

  test('a bare code we do not know is not made its own name', () => {
    // The regression: this produced name === code, and the detail page then
    // rendered "261312 261312".
    const occ = resolveOccupation('261312', '');
    expect(occ.code).toBe('261312');
    expect(occ.name).toBe('');
    expect([occ.code, occ.name].filter(Boolean).join(' ')).toBe('261312');
  });

  test('code plus name keeps just the name', () => {
    expect(resolveOccupation('261312 Developer Programmer', '').name).toBe(
      'Developer Programmer'
    );
  });

  test('free text with no code is kept as the name', () => {
    const occ = resolveOccupation('Developer Programmer', '');
    expect(occ.code).toBe('');
    expect(occ.name).toBe('Developer Programmer');
  });
});

describe('what the ANZSCO code alone can answer', () => {
  test('the name, assessor and visas all come from the code', () => {
    // Nothing but a code on the job: everything else is looked up.
    const occ = resolveOccupation('261313', '');
    expect(occ.name).toBe('Software Engineer');
    expect(occ.assessment).toBe('ACS');
    expect(occ.assessmentHref).toBeTruthy();
    expect(occ.anzscoHref).toBeTruthy();
    expect(occ.visas.length).toBeGreaterThan(0);
  });

  test('the reference file wins over an assessor typed on the job', () => {
    // The regression: a job saying "Engineers Australia" against 261313 used to
    // override the file and contradict every other listing for that occupation.
    expect(resolveOccupation('261313', 'Engineers Australia').assessment).toBe('ACS');
  });

  test('a typed assessor still covers an occupation nobody has written up', () => {
    expect(resolveOccupation('261312', 'ACS').assessment).toBe('ACS');
  });

  test('two occupations keep their own assessors rather than sharing one', () => {
    const both = resolveOccupations({
      anzscos: ['261313', '233999'],
      skillAssessment: 'ACS',
    } as Job);
    expect(both.map((o) => o.assessment)).toEqual(['ACS', 'Engineers Australia']);
  });

  test('pathways come from the code, so a job need not list them', () => {
    const pathways = pathwayVisasFor({
      anzscos: ['261313'],
      skillAssessment: '',
      visaPathways: [],
    } as unknown as Job);
    expect(pathways).toEqual(
      expect.arrayContaining(['189', '190', '186', '482', '485'])
    );
  });
});
