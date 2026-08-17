import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Company, findCompany, loadCompanies, searchCompanies } from '../companies';

/** How many suggestions to render; the rest are reached by typing. */
const MAX_VISIBLE = 60;

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /**
   * Called when the typed name matches a company on the national list, so the form can
   * fill in the blurb and the link.
   */
  onMatch: (company: Company | undefined) => void;
  required?: boolean;
  hint?: React.ReactNode;
}

/** Company name field backed by the national startup list. */
export function CompanyPicker({
  id,
  label,
  value,
  onChange,
  onMatch,
  required,
  hint,
}: Props) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const ensureLoaded = () => {
    if (status !== 'idle') return;
    setStatus('loading');
    loadCompanies()
      .then((data) => {
        setCompanies(data);
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

  const matched = useMemo(() => findCompany(companies, value), [companies, value]);

  // Reported whenever an exact name match appears or disappears, including when the list
  // finishes loading after the name was already typed.
  useEffect(() => {
    onMatch(matched);
    // onMatch is a fresh closure each render in the parent; depending on it would fire this
    // on every keystroke. eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched]);

  const matches = useMemo(
    () => searchCompanies(companies, value).slice(0, MAX_VISIBLE),
    [companies, value]
  );

  const choose = (company: Company) => {
    onChange(company.name);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setOpen(false);
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
    if (event.key === 'Enter' && open && matches[active]) {
      event.preventDefault();
      choose(matches[active]);
    }
  };

  return (
    <div className="field combo" ref={rootRef}>
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
        placeholder="Start typing your company name"
        value={value}
        onFocus={() => {
          ensureLoaded();
          setOpen(true);
          setActive(0);
        }}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
      />

      {open && (
        <div className="combo-panel">
          {status === 'loading' && <p className="combo-note">Loading companies . . .</p>}
          {status === 'error' && (
            <p className="combo-note">
              Couldn't load the company list. Type your company name and carry on.
            </p>
          )}
          {status === 'ready' && matches.length === 0 && (
            <p className="combo-note">
              “{value}” isn't on our list. That's fine, carry on and we'll add it.
            </p>
          )}
          {matches.length > 0 && (
            <ul className="combo-list" id={listId} role="listbox" aria-label={label}>
              {matches.map((company, i) => (
                <li key={company.name}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    className={`combo-option${i === active ? ' is-active' : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(company)}
                  >
                    <span className="combo-title">{company.name}</span>
                    {company.openings > 0 && (
                      <span className="combo-code">{company.openings} open</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {matched && (
        <span className="field-hint combo-matched">
          Found on our list. We've filled in the one-liner and link below.
        </span>
      )}
      {hint && !matched && <span className="field-hint">{hint}</span>}
    </div>
  );
}
