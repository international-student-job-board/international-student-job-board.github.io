import {
  formatStart,
  isStartAsap,
  START_ASAP,
  NOT_SPECIFIED,
  formatMoney,
  formatSalary,
  formatSalaryAud,
} from './format';
import type { Salary } from './types';

const salary = (over: Partial<Salary>): Salary => ({
  source: '',
  sourceUrl: '',
  isEstimate: false,
  ...over,
});

describe('a role start date has three possible answers', () => {
  test('a date reads as a date', () => {
    expect(formatStart('2026-09-01')).toBe('1 Sept 2026');
  });

  test('as soon as possible reads as words, not as a date', () => {
    expect(formatStart(START_ASAP)).toBe('As soon as possible');
    // Whatever case it was written in — the file is edited by hand.
    expect(formatStart('ASAP')).toBe('As soon as possible');
    expect(formatStart('  Asap ')).toBe('As soon as possible');
  });

  test('nothing said reads as nothing said', () => {
    expect(formatStart('')).toBe(NOT_SPECIFIED);
    expect(formatStart('   ')).toBe(NOT_SPECIFIED);
  });

  test('"as soon as possible" is not mistaken for a missing answer', () => {
    // The distinction the filter leans on: ASAP is an answer, blank is not.
    expect(isStartAsap(START_ASAP)).toBe(true);
    expect(isStartAsap('')).toBe(false);
    expect(isStartAsap('2026-09-01')).toBe(false);
  });
});

describe('salary figures', () => {
  test('past ten thousand it rounds to a k, below that it stays exact', () => {
    expect(formatMoney(142788)).toBe('A$143k');
    expect(formatMoney(9500)).toBe('A$9,500');
  });

  test('a non-AUD currency keeps its own marker', () => {
    expect(formatMoney(101268, 'USD')).toBe('US$101k');
  });

  test('a range reads as a range, a single figure as one number', () => {
    expect(formatSalary(142788, 160727)).toBe('A$143k–A$161k');
    expect(formatSalary(73320, 73320)).toBe('A$73k');
    expect(formatSalary(undefined, 90000)).toBe('A$90k');
  });

  test('nothing to show is the empty string, not "A$0"', () => {
    expect(formatSalary()).toBe('');
    expect(formatSalary(0, 0)).toBe('');
  });
});

describe('formatSalaryAud', () => {
  test('an advert-stated range is shown as-is, no "~"', () => {
    expect(
      formatSalaryAud(salary({ base: { currency: 'AUD', minAud: 95000, maxAud: 110000 }, source: 'advert' }))
    ).toBe('A$95k–A$110k');
  });

  test('a Glassdoor / levels.fyi figure is prefixed "~"', () => {
    expect(
      formatSalaryAud(salary({ base: { currency: 'AUD', minAud: 120000, maxAud: 158000 }, isEstimate: true }))
    ).toBe('~A$120k–A$158k');
    expect(formatSalaryAud(salary({ estimateAud: 145000, isEstimate: true }))).toBe('~A$145k');
  });

  test('no pay figure is the empty string', () => {
    expect(formatSalaryAud(salary({}))).toBe('');
  });
});
