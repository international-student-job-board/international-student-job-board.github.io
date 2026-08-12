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
 * Occupation picker built on the same control as the job filters: a trigger, a
 * panel of tick boxes, and a search over them. Ticking does not close the
 * panel, so several codes can be chosen in one pass and the panel dismissed
 * when you're done. The previous version closed on every pick, which made
 * choosing a second occupation feel like correcting a mistake.
 *
 * Several occupations is the normal case, not an edge case: a role often
 * straddles two ANZSCO codes, and which one an applicant is assessed under
 * changes their visa options.
 *
 * Free text is still accepted. The list is long but not exhaustive, and a
 * posting form should never refuse a role because its occupation isn't on a
 * dropdown — but it is added as a deliberate row rather than by typing, so
 * nobody records a half-typed search by accident.
 */
export function AnzscoPicker({ id, label, value, onChange, required, hint }: Props) {
  const [rows, setRows] = useState<AnzscoOccupation[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const panelId = useId();

  // Fetched on first open, not on mount: most people filling this form never
  // touch the occupation field, and it is the largest thing the page loads.
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
    const root = rootRef.current;

    const onPointerDown = (event: PointerEvent) => {
      if (!root?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  // The whole matching list, uncapped; `content-visibility` in the stylesheet
  // keeps rows scrolled out of view from being laid out.
  const matches = useMemo(() => searchAnzsco(rows, query), [rows, query]);

  const toggle = (entry: string) => {
    onChange(value.includes(entry) ? value.filter((v) => v !== entry) : [...value, entry]);
  };

  const typed = query.trim();
  const canAddTyped =
    typed.length > 2 &&
    !matches.some((row) => anzscoLabel(row).toLowerCase() === typed.toLowerCase()) &&
    !value.includes(typed);

  const className = [
    'fselect',
    open ? 'is-open' : '',
    value.length > 0 ? 'is-active' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="field field-wide">
      <span className="label-text" id={`${id}-label`}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </span>

      <div className={className} ref={rootRef}>
        <button
          type="button"
          id={id}
          ref={triggerRef}
          className="fselect-trigger"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          aria-labelledby={`${id}-label ${id}`}
          onClick={() => {
            ensureLoaded();
            setOpen((o) => !o);
          }}
        >
          <span className="fselect-label">
            {value.length === 0 ? 'Choose occupations' : `${value.length} chosen`}
          </span>
          {value.length > 0 && <span className="fselect-count">{value.length}</span>}
        </button>

        {open && (
          <div className="fselect-panel" id={panelId} data-align="left">
            <input
              ref={searchRef}
              type="text"
              className="fselect-search"
              placeholder="Search by job name or 6-digit code"
              aria-label="Search occupations"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            {status === 'loading' && <p className="combo-note">Loading occupations . . .</p>}
            {status === 'error' && (
              <p className="combo-note">
                Couldn't load the occupation list. Type the occupation and add it below.
              </p>
            )}

            <div className="fselect-options" role="group" aria-labelledby={`${id}-label`}>
              {canAddTyped && (
                <button
                  type="button"
                  className="fselect-option fselect-add"
                  onClick={() => {
                    toggle(typed);
                    setQuery('');
                  }}
                >
                  Add “{typed}” as typed
                </button>
              )}

              {matches.map((row) => {
                const entry = anzscoLabel(row);
                return (
                  <label key={row.code} className="fselect-option">
                    <input
                      type="checkbox"
                      checked={value.includes(entry)}
                      onChange={() => toggle(entry)}
                    />
                    <span className="combo-code">{row.code}</span>
                    <span className="fselect-option-label">{row.title}</span>
                  </label>
                );
              })}

              {status === 'ready' && !matches.length && !canAddTyped && (
                <p className="combo-note">No match for “{query}”.</p>
              )}
            </div>

            <div className="fselect-foot">
              <span className="fselect-status">
                {value.length > 0 ? `${value.length} chosen` : 'None chosen'}
                {matches.length > 0 && ` · ${matches.length} shown`}
              </span>
              <button
                type="button"
                className="fselect-reset"
                disabled={value.length === 0}
                onClick={() => onChange([])}
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {value.length > 0 && (
        <ul className="chosen-list">
          {value.map((entry) => (
            <li key={entry}>
              <button
                type="button"
                className="active-chip"
                onClick={() => toggle(entry)}
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
