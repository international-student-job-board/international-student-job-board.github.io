import {
  pathwayVisasFor,
  resolveOccupation,
  occupationCodesFor,
  assessmentsFor,
} from './references';
import { Job } from './types';

// 261313 Software Engineer is in the reference file and carries a long visa
// list of its own, which is what makes it useful here.
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
