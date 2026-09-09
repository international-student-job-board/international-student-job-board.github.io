import { useEffect, useId, useRef, useState } from 'react';
import { InfoTooltip } from './InfoTooltip';

export interface RangeValue {
  /** Lower bound in AUD; 0 means "no minimum". */
  min: number;
  /** Upper bound in AUD; 0 means "no maximum". */
  max: number;
}

interface Props {
  label: string;
  value: RangeValue;
  onChange: (next: RangeValue) => void;
  /** The rungs offered in both dropdowns, ascending, in AUD. */
  steps: number[];
  format: (aud: number) => string;
  tooltip?: string;
}

/**
 * A two-ended numeric filter — pick a minimum, a maximum, or both.
 *
 * Built as a single popover to sit in the same filter row as the multi-selects,
 * and opened/closed the same way (outside click, Escape, focus-out) so it
 * behaves like its neighbours. A blank end is "unbounded", not zero.
 */
export function RangeFilter({ label, value, onChange, steps, format, tooltip }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const root = rootRef.current;
    const onPointerDown = (event: PointerEvent) => {
      if (!root?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
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

  const active = value.min > 0 || value.max > 0;
  const summary = active
    ? `${value.min > 0 ? format(value.min) : 'Any'} – ${value.max > 0 ? format(value.max) : 'Any'}`
    : '';

  // The max can't sit below the chosen min, and vice versa.
  const maxOptions = steps.filter((s) => !value.min || s > value.min);
  const minOptions = steps.filter((s) => !value.max || s < value.max);

  const className = ['fselect', open ? 'is-open' : '', active ? 'is-active' : '']
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
        onClick={() => setOpen((o) => !o)}
      >
        <span className="fselect-label">{label}</span>
        {active && <span className="fselect-count is-text">{summary}</span>}
      </button>

      {open && (
        <div className="fselect-panel" id={panelId} data-align="left">
          <div className="range-row">
            <label className="range-field">
              <span>Min</span>
              <select
                value={value.min || ''}
                onChange={(e) => onChange({ ...value, min: Number(e.target.value) })}
              >
                <option value="">Any</option>
                {minOptions.map((step) => (
                  <option key={step} value={step}>
                    {format(step)}
                  </option>
                ))}
              </select>
            </label>
            <label className="range-field">
              <span>Max</span>
              <select
                value={value.max || ''}
                onChange={(e) => onChange({ ...value, max: Number(e.target.value) })}
              >
                <option value="">Any</option>
                {maxOptions.map((step) => (
                  <option key={step} value={step}>
                    {format(step)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="fselect-foot">
            <span className="fselect-foot-info">
              {tooltip && <InfoTooltip text={tooltip} label={`What "${label}" means`} />}
              <span className="fselect-status">{active ? summary : 'Any'}</span>
            </span>
            <button
              type="button"
              className="fselect-reset"
              disabled={!active}
              onClick={() => onChange({ min: 0, max: 0 })}
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
