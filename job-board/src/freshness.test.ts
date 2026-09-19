import { freshness } from './freshness';
import { Job } from './types';

const job = (posted: string) => ({ posted }) as Job;

describe('how fresh the board is', () => {
  const today = '2026-09-19';

  test('counts what arrived today and yesterday, and this week', () => {
    const f = freshness(
      [
        job('2026-09-19'),
        job('2026-09-18'),
        job('2026-09-18'),
        job('2026-09-14'),
        job('2026-08-01'),
      ],
      today
    );
    expect(f.last24h).toBe(3);
    expect(f.last7d).toBe(4);
    expect(f.newest).toBe('2026-09-19');
  });

  test('"the last 24 hours" is today and yesterday - dates carry no time - as the filter has it', () => {
    expect(freshness([job('2026-09-18')], today).last24h).toBe(1);
    expect(freshness([job('2026-09-17')], today).last24h).toBe(0);
  });

  test('it is daily while the newest role is at most two days old', () => {
    expect(freshness([job('2026-09-19')], today).current).toBe(true);
    expect(freshness([job('2026-09-17')], today).current).toBe(true);
  });

  test('and stops claiming so when a refresh has been missed', () => {
    const stale = freshness([job('2026-09-16'), job('2026-09-10')], today);
    expect(stale.current).toBe(false);
    expect(stale.newest).toBe('2026-09-16');
  });

  test('an empty board has nothing to say', () => {
    expect(freshness([], today)).toEqual({ newest: '', last24h: 0, last7d: 0, current: false });
  });

  test('roles with no date do not count and do not crash', () => {
    const f = freshness([job(''), job('2026-09-19')], today);
    expect(f.last24h).toBe(1);
  });
});
