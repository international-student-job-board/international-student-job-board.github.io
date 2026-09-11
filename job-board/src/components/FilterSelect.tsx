import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { InfoTooltip } from './InfoTooltip';

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
  /** Multi-select by default. */
  multiple?: boolean;
  /**
   * What the filter means, on an "i" in the open panel's footer.
   */
  tooltip?: string;
  /** A source link, in that same footer beside the tooltip. */
  footerLink?: { label: string; href: string };
  /** Show the type-to-filter box for long lists. Off on touch, where it only
   * summons a keyboard that covers the options. Default on. */
  searchable?: boolean;
  /** Float the panel over everything (position: fixed) rather than anchoring it
   * to the trigger. Needed inside the scrolling filter modal, where an absolute
   * panel would be clipped. */
  overlay?: boolean;
}

/** Longer lists get a filter box; short ones are faster to just read. */
const SEARCH_THRESHOLD = 8;

/** Roughly the panel width, used to decide which edge to anchor it to. */
const PANEL_WIDTH = 300;

type Pos = { top: number; left: number; width: number; maxHeight: number };

export function FilterSelect({
  label,
  options,
  selected,
  onChange,
  multiple = true,
  tooltip,
  footerLink,
  searchable = true,
  overlay = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [alignRight, setAlignRight] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const panelId = useId();

  const showSearch = searchable && options.length > SEARCH_THRESHOLD;
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? options.filter((o) => o.label.toLowerCase().includes(needle))
    : options;

  // An open panel closes on a click anywhere outside it, on Escape, and when focus tabs
  // away — three ways out, so it never feels like a trap.
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
    // A floating panel can't follow the page or modal behind it, so it closes on
    // a scroll there — but NOT on a scroll of its own option list, which is what
    // ticking a box near the bottom of a long list does.
    const onScroll = (event: Event) => {
      if (!root?.contains(event.target as Node)) setOpen(false);
    };
    if (overlay) window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      root?.removeEventListener('focusout', onFocusOut);
      if (overlay) window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, overlay]);

  // Position the panel: anchored to the roomier edge normally, or floated over
  // everything (from the trigger's viewport rect) when `overlay`.
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setAlignRight(rect.left + PANEL_WIDTH > window.innerWidth - 16);
    if (overlay) {
      const width = Math.min(PANEL_WIDTH, window.innerWidth - 24);
      const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const dropDown = below >= 220 || below >= above;
      const room = dropDown ? below : above;
      setPos({
        top: dropDown ? rect.bottom + 6 : Math.max(12, rect.top - 6 - Math.min(above, 360)),
        left,
        width,
        // Bounded by the room on that side so the panel can't run off the
        // screen, and capped so it isn't needlessly tall on a desktop; the
        // option list scrolls within whatever height this leaves.
        maxHeight: Math.max(140, Math.min(room, 420)),
      });
    }
    searchRef.current?.focus();
  }, [open, overlay]);

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
        <div
          className="fselect-panel"
          id={panelId}
          data-align={alignRight ? 'right' : 'left'}
          data-overlay={overlay ? '' : undefined}
          style={
            overlay && pos
              ? { position: 'fixed', top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }
              : undefined
          }
        >
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
                    // Re-picking the option a radio already holds fires no change event, so
                    // close on the click itself — otherwise that one option leaves the
                    // panel stuck open.
                    onClick={() => {
                      if (!multiple && selected.includes(option.value)) setOpen(false);
                    }}
                  />
                  <span className="fselect-option-label">{option.label}</span>
                  {option.count !== undefined && (
                    <span className="fselect-option-count">
                      {option.count}
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
            <span className="fselect-foot-info">
              {tooltip && <InfoTooltip text={tooltip} label={`What "${label}" means`} />}
              {footerLink && (
                <a
                  className="fselect-foot-link"
                  href={footerLink.href}
                  target="_blank"
                  rel="noopener"
                  referrerPolicy="strict-origin-when-cross-origin"
                >
                  {footerLink.label}
                </a>
              )}
              <span className="fselect-status">
                {selected.length > 0 ? `${selected.length} selected` : 'None selected'}
              </span>
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
