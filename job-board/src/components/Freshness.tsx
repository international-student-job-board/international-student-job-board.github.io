import { useMemo } from 'react';
import { freshness } from '../freshness';
import { formatDate } from '../format';
import { trackEvent } from '../analytics';
import { Job } from '../types';

/**
 * "Updated daily", with the proof beside it: how many roles arrived in the last day. It says the
 * board is daily only when the data is (see freshness.ts), and shows those roles on a click.
 */
export function Freshness({
  jobs,
  today,
  onShow,
}: {
  jobs: Job[];
  today?: string;
  /** Show those roles: the board narrowed to the last `days` days. */
  onShow: (days: number) => void;
}) {
  const f = useMemo(() => freshness(jobs, today), [jobs, today]);
  if (!f.newest) return null;

  if (!f.current) {
    return (
      <p className="freshness freshness-stale">
        <span className="freshness-dot" aria-hidden="true" />
        Last updated {formatDate(f.newest)}
      </p>
    );
  }

  const [count, window, days] =
    f.last24h > 0 ? [f.last24h, 'in the last 24 hours', 1] : [f.last7d, 'this week', 7];
  const noun = count === 1 ? 'new role' : 'new roles';

  return (
    <p className="freshness">
      <span className="freshness-dot" aria-hidden="true" />
      <span>Updated every day</span>
      {count > 0 && (
        <>
          <span className="freshness-sep" aria-hidden="true">
            ·
          </span>
          <button
            type="button"
            className="freshness-link"
            onClick={() => {
              trackEvent('freshness_click', { window: `${days}d`, roles: count });
              onShow(days);
            }}
          >
            {count.toLocaleString('en-AU')} {noun} {window}
          </button>
        </>
      )}
    </p>
  );
}
