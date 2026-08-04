import { useState } from 'react';

// Multi-select tag picker with an inline "＋ Add" that lets you type new tags
// (staying open so you can add several in a row, like howwefeel.org). Adding a
// tag that already exists just selects it - no duplicates. When `onAdd` is
// given (local admin) the new tag is also persisted to the shared list.
export function TagSelect({
  legend,
  hint,
  options,
  selected,
  onToggle,
  onAdd,
  addLabel = 'skill',
}: {
  legend: string;
  hint?: string;
  options: string[];
  selected: string[];
  onToggle: (tag: string) => void;
  onAdd?: (tag: string) => void | Promise<void>;
  addLabel?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  // Show every known tag plus any custom-selected ones, de-duplicated.
  const allTags = Array.from(new Set([...options, ...selected]));

  const commit = async () => {
    const v = text.trim();
    if (!v) return;
    const existing = allTags.find((t) => t.toLowerCase() === v.toLowerCase());
    setBusy(true);
    try {
      if (existing) {
        if (!selected.includes(existing)) onToggle(existing);
      } else {
        if (onAdd) await onAdd(v);
        onToggle(v);
      }
    } finally {
      setBusy(false);
      setText(''); // keep the box open for the next tag
    }
  };

  return (
    <div className="field field-wide">
      <span className="label-text">
        {legend}
        {selected.length > 0 && <span className="picker-count">{selected.length}</span>}
      </span>
      {hint && <span className="field-hint">{hint}</span>}
      <div className="tag-select">
        {allTags.map((t) => {
          const on = selected.includes(t);
          return (
            <button
              key={t}
              type="button"
              className={`visa-chip${on ? ' is-on' : ''}`}
              aria-pressed={on}
              onClick={() => onToggle(t)}
            >
              <span className="visa-chip-mark" aria-hidden="true">
                {on ? '✓' : '+'}
              </span>
              <span className="visa-chip-name">{t}</span>
            </button>
          );
        })}

        {adding ? (
          <span className="tag-add-row">
            {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
            <input
              autoFocus
              type="text"
              value={text}
              placeholder={`New ${addLabel}`}
              aria-label={`New ${addLabel}`}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commit();
                } else if (e.key === 'Escape') {
                  setAdding(false);
                  setText('');
                }
              }}
            />
            <button
              type="button"
              className="btn btn-small"
              disabled={busy}
              onClick={commit}
            >
              Add
            </button>
            <button
              type="button"
              className="btn btn-small btn-ghost"
              onClick={() => {
                setAdding(false);
                setText('');
              }}
            >
              Done
            </button>
          </span>
        ) : (
          <button type="button" className="tag-add-btn" onClick={() => setAdding(true)}>
            ＋ Add {addLabel}
          </button>
        )}
      </div>
    </div>
  );
}
