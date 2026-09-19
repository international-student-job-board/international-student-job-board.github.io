import { useState } from 'react';
import { ANNOUNCE_DAYS, UPDATES, Update } from '../whatsNew';
import { daysBeforeISO, formatDate, todayISO } from '../format';
import { trackEvent } from '../analytics';

const SEEN_KEY = 'whatsNewSeen';

/** What the reader last dismissed. Storage can be blocked (private windows, blocked site data), and
 * the banner must work without it - it just shows again. */
function readSeen(): string {
  try {
    return window.localStorage.getItem(SEEN_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeSeen(date: string): void {
  try {
    window.localStorage.setItem(SEEN_KEY, date);
  } catch {
    /* nothing to do - it will show again next visit */
  }
}

/**
 * The newest change to the board, dated, with the earlier ones a click behind it.
 *
 * Dismissible, and a dismissal is remembered against *that* entry - so someone who has read it
 * isn't shown it again, and a newer one appears for them regardless. It also retires itself once
 * the news is old, so the banner is never the same sentence for months.
 */
export function WhatsNew({
  updates = UPDATES,
  today = todayISO(),
}: {
  updates?: Update[];
  today?: string;
}) {
  const [latest, ...earlier] = updates;
  const [seen, setSeen] = useState(readSeen);
  const [open, setOpen] = useState(false);

  if (!latest) return null;
  const fresh = latest.date >= daysBeforeISO(today, ANNOUNCE_DAYS);
  if (!fresh || seen === latest.date) return null;

  return (
    <div className="whats-new" role="note" aria-label="What's new">
      <p className="whats-new-line">
        <strong>New · {formatDate(latest.date)}</strong> {latest.text}
        {earlier.length > 0 && (
          <>
            {' '}
            <button
              type="button"
              className="whats-new-more"
              aria-expanded={open}
              onClick={() => {
                if (!open) trackEvent('whats_new', { action: 'open_list', update: latest.date });
                setOpen((o) => !o);
              }}
            >
              {open ? 'Hide earlier updates' : 'Earlier updates'}
            </button>
          </>
        )}
      </p>
      <button
        type="button"
        className="whats-new-dismiss"
        aria-label="Dismiss this announcement"
        onClick={() => {
          trackEvent('whats_new', { action: 'dismiss', update: latest.date });
          writeSeen(latest.date);
          setSeen(latest.date);
        }}
      >
        ×
      </button>
      {open && (
        <ul className="whats-new-list">
          {earlier.map((update) => (
            <li key={update.date + update.text}>
              <strong>{formatDate(update.date)}</strong> {update.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
