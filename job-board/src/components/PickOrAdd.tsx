import { useState } from 'react';

// A <select> that picks from a constant list, with an optional "＋ Add new…"
// path. When `onAdd` is given, choosing "Add new" reveals a text box; adding
// persists the value (via the caller) and selects it. Without `onAdd` it's a
// plain picker (used on the public form, which can't write files).
export function PickOrAdd({
  id,
  label,
  required,
  placeholder,
  options,
  value,
  onChange,
  onAdd,
  hint,
}: {
  id: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  onAdd?: (value: string) => Promise<void>;
  hint?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const commit = async () => {
    const v = text.trim();
    if (!v) return;
    setBusy(true);
    setError('');
    try {
      if (onAdd && !options.includes(v)) await onAdd(v);
      onChange(v);
      setAdding(false);
      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`field ${adding ? 'field-wide' : ''}`}>
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>

      {adding ? (
        <div className="pick-add-row">
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <input
            autoFocus
            type="text"
            value={text}
            placeholder={placeholder || 'New value'}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              }
            }}
          />
          <button type="button" className="btn btn-small" disabled={busy} onClick={commit}>
            {busy ? '…' : 'Add'}
          </button>
          <button
            type="button"
            className="btn btn-small btn-ghost"
            onClick={() => {
              setAdding(false);
              setText('');
              setError('');
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <select
          id={id}
          value={value}
          onChange={(e) => {
            if (e.target.value === '__add__') setAdding(true);
            else onChange(e.target.value);
          }}
        >
          <option value="">Choose . . .</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
          {onAdd && <option value="__add__">＋ Add new . . .</option>}
        </select>
      )}

      {error && <span className="field-error-inline">{error}</span>}
      {hint && !error && <span className="field-hint">{hint}</span>}
    </div>
  );
}
