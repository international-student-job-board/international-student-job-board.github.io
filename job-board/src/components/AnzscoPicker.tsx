import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AnzscoOccupation,
  anzscoLabel,
  loadAnzscoCodes,
  searchAnzsco,
} from '../anzsco';

interface Props {
  id: string;
  label: string;
  /** The chosen occupations, each stored as "261313 Software Engineer". */
  value: string[];
  onChange: (value: string[]) => void;
  required?: boolean;
  hint?: React.ReactNode;
}

/**
 * Search-as-you-type picker over the whole ANZSCO list. A <select> of 1,400
 * options is unusable, and a plain text box asks the poster to know a 6-digit
 * code by heart — this takes either the code or the name of the job.
 *
 * Several occupations can be chosen: a role often straddles two ANZSCO codes,
 * and which one an applicant is assessed under changes their visa options, so
 * making the poster pick just one throws away something the reader needs.
 *
 * Free text is deliberately allowed: the list is long but not exhaustive, and a
 * posting form should never refuse a role because its occupation isn't on a
 * dropdown. Pressing Enter on text that matches nothing keeps it as typed.
 */
export function AnzscoPicker({ id, label, value, onChange, required, hint }: Props) {
  const [rows, setRows] = useState<AnzscoOccupation[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();



  // Fetched on first focus, not on mount: most people filling this form never
  // touch the occupation field, and it is the largest thing the page can load.
  const ensureLoaded = () => {
    if (status !== 'idle') return;
    setStatus('loading');
    loadAnzscoCodes()
      .then((data) => {
        setRows(data);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // The whole list, every time — nothing is capped, so scrolling reaches the
  // last occupation whether or not anything has been typed. Memoised because
  // sorting 1,400 rows on every keystroke of an unrelated field would be
  // wasted work, and `content-visibility` in the stylesheet keeps the browser
  // from laying out the rows that are scrolled out of view.
  // Everything already chosen drops out of the list, so the same occupation
  // can't be added twice.
  const matches = useMemo(() => {
    const chosen = new Set(value);
    return searchAnzsco(rows, query).filter((row) => !chosen.has(anzscoLabel(row)));
  }, [rows, query, value]);

  const add = (entry: string) => {
    const next = entry.trim();
    if (!next || value.includes(next)) return;
    onChange([...value, next]);
    setQuery('');
    setActive(0);
  };

  const remove = (entry: string) => onChange(value.filter((v) => v !== entry));

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setOpen(false);
      setQuery('');
      return;
    }
    // Backspace on an empty box removes the last chip, the way tag inputs do.
    if (event.key === 'Backspace' && !query && value.length) {
      remove(value[value.length - 1]);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => Math.max(0, Math.min(matches.length - 1, i + step)));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (open && matches[active]) add(anzscoLabel(matches[active]));
      else if (query.trim()) add(query);
    }
  };

  return (
    <div className="field field-wide combo" ref={rootRef}>
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>

      <input
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-autocomplete="list"
        placeholder={value.length ? "Add another occupation" : "Search by job name or 6-digit code"}
        value={query}
        // Opening shows the whole list to browse; typing filters it.
        onFocus={() => {
          ensureLoaded();
          setOpen(true);
          setActive(0);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
      />

      {open && (
        <div className="combo-panel">
          {status === 'loading' && <p className="combo-note">Loading occupations . . .</p>}
          {status === 'error' && (
            <p className="combo-note">
              Couldn't load the occupation list. Type the occupation instead and we'll match it
              up.
            </p>
          )}
          {status === 'ready' && matches.length === 0 && (
            <p className="combo-note">
              No match for “{query}”. You can leave what you've typed and we'll sort it out.
            </p>
          )}
          {matches.length > 0 && (
            <>
            <ul className="combo-list" id={listId} role="listbox" aria-label={label}>
              {matches.map((row, i) => (
                <li key={row.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    className={`combo-option${i === active ? ' is-active' : ''}`}
                    // The input must keep focus, or the panel closes before the
                    // click lands.
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => add(anzscoLabel(row))}
                  >
                    <span className="combo-code">{row.code}</span>
                    <span className="combo-title">{row.title}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="combo-count" aria-live="polite">
              {matches.length} occupation{matches.length === 1 ? '' : 's'}
              {matches.length === rows.length ? ' : : scroll, or type to narrow' : ''}
            </p>
            </>
          )}
        </div>
      )}

      {value.length > 0 && (
        <ul className="chosen-list">
          {value.map((entry) => (
            <li key={entry}>
              <button
                type="button"
                className="active-chip"
                onClick={() => remove(entry)}
                title={`Remove ${entry}`}
              >
                <span className="active-chip-value">{entry}</span>
                <span className="active-chip-x" aria-hidden="true" />
                <span className="visually-hidden">Remove occupation</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}
