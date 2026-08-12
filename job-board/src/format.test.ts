import { formatStart, isStartAsap, START_ASAP, NOT_SPECIFIED } from './format';

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
