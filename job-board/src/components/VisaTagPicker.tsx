import { VISA_OPTIONS } from '../references';

// Multi-select visa chips shared by the public form and the local admin. Each
// visa is a toggle chip showing its full detail ("189 - Skilled Independent
// visa"); selected chips fill in and show a check. Options are ordered by
// subclass code (VISA_OPTIONS is pre-sorted).
export function VisaTagPicker({
  legend,
  hint,
  selected,
  onToggle,
}: {
  legend: string;
  hint?: string;
  selected: string[];
  onToggle: (code: string) => void;
}) {
  const count = selected.length;
  return (
    <div className="field field-wide">
      <span className="label-text">
        {legend}
        {count > 0 && <span className="picker-count">{count}</span>}
      </span>
      {hint && <span className="field-hint">{hint}</span>}
      <div className="visa-chips" role="group" aria-label={legend}>
        {VISA_OPTIONS.map((v) => {
          const on = selected.includes(v.code);
          return (
            <button
              key={v.code}
              type="button"
              className={`visa-chip${on ? ' is-on' : ''}`}
              aria-pressed={on}
              onClick={() => onToggle(v.code)}
            >
              <span className="visa-chip-mark" aria-hidden="true">
                {on ? '✓' : '+'}
              </span>
              <span className="visa-chip-code">{v.code}</span>
              <span className="visa-chip-name">{v.name} visa</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Helpers for storing a tag selection as a pipe-joined string (jobs.json / the
// email draft both use pipe lists).
export const pipeToList = (value: string): string[] =>
  value ? value.split('|').filter(Boolean) : [];

export const toggleInPipe = (value: string, code: string): string => {
  const list = pipeToList(value);
  const next = list.includes(code) ? list.filter((c) => c !== code) : [...list, code];
  return next.join('|');
};
