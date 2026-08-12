import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  /** How many results this option would leave. Omitted where not counted. */
  count?: number;
}

interface Props {
  /** Names the dimension being filtered ("Job type"), not the current value. */
  label: string;
  options: SelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  /**
   * Multi-select by default. The salary threshold is the one single-choice
   * control — picking two minimums would only ever mean the lower one — but it
   * keeps the same trigger and panel so the filter row reads as one control.
   */
  multiple?: boolean;
}

/** Longer lists get a filter box; short ones are faster to just read. */
const SEARCH_THRESHOLD = 8;

/** Roughly the panel width, used to decide which edge to anchor it to. */
const PANEL_WIDTH = 300;

export function FilterSelect({ label, options, selected, onChange, multiple = true }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [alignRight, setAlignRight] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const panelId = useId();

  const showSearch = options.length > SEARCH_THRESHOLD;
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? options.filter((o) => o.label.toLowerCase().includes(needle))
    : options;

  // An open panel closes on a click anywhere outside it, on Escape, and when
  // focus tabs away — three ways out, so it never feels like a trap.
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
    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget as Node | null;
      if (next && !root?.contains(next)) setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    root?.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      root?.removeEventListener('focusout', onFocusOut);
    };
  }, [open]);

  // Anchor the panel to whichever edge keeps it on screen — the filter row
  // wraps, so a control can sit anywhere across the width.
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    if (!trigger) return;
    const { left } = trigger.getBoundingClientRect();
    setAlignRight(left + PANEL_WIDTH > window.innerWidth - 16);
    searchRef.current?.focus();
  }, [open]);

  const toggle = (value: string) => {
    if (!multiple) {
      onChange([value]);
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    );
  };

  const openPanel = (next: boolean) => {
    setOpen(next);
    if (!next) setQuery('');
  };

  const className = [
    'fselect',
    open ? 'is-open' : '',
    selected.length > 0 ? 'is-active' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className} ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        className="fselect-trigger"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => openPanel(!open)}
      >
        <span className="fselect-label">{label}</span>
        {selected.length > 0 && (
          <span className="fselect-count" aria-label={`${selected.length} selected`}>
            {selected.length}
          </span>
        )}
      </button>

      {open && (
        <div className="fselect-panel" id={panelId} data-align={alignRight ? 'right' : 'left'}>
          {showSearch && (
            <input
              ref={searchRef}
              type="text"
              className="fselect-search"
              placeholder={`Search ${label.toLowerCase()}`}
              aria-label={`Search ${label.toLowerCase()}`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}

          <div className="fselect-options" role="group" aria-label={label}>
            {shown.length === 0 ? (
              <p className="fselect-empty">No matches for “{query}”</p>
            ) : (
              shown.map((option) => (
                <label key={option.value} className="fselect-option">
                  <input
                    type={multiple ? 'checkbox' : 'radio'}
                    name={multiple ? undefined : panelId}
                    checked={selected.includes(option.value)}
                    onChange={() => toggle(option.value)}
                    // Re-picking the option a radio already holds fires no
                    // change event, so close on the click itself — otherwise
                    // that one option leaves the panel stuck open.
                    onClick={() => {
                      if (!multiple && selected.includes(option.value)) setOpen(false);
                    }}
                  />
                  <span className="fselect-option-label">{option.label}</span>
                  {option.count !== undefined && (
                    <span className="fselect-option-count">
                      {option.count}
                      {/* The number is inside the label, so it reads out as
                          part of the option. On its own "3" says nothing. */}
                      <span className="visually-hidden">
                        {option.count === 1 ? ' result' : ' results'}
                      </span>
                    </span>
                  )}
                </label>
              ))
            )}
          </div>

          <div className="fselect-foot">
            <span className="fselect-status">
              {selected.length > 0 ? `${selected.length} selected` : 'None selected'}
            </span>
            <button
              type="button"
              className="fselect-reset"
              disabled={selected.length === 0}
              onClick={() => onChange([])}
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
