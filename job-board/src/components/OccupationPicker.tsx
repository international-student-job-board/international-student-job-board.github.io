import { useMemo, useState } from 'react';
import { listOccupations, OccupationChoice } from '../references';

/** Picks one or more ANZSCO occupations for a role. */
export function OccupationPicker({
  selected,
  onChange,
}: {
  selected: OccupationChoice[];
  onChange: (next: OccupationChoice[]) => void;
}) {
  const [query, setQuery] = useState('');
  const all = useMemo(() => listOccupations(), []);

  // Matched on the name and on both codes, so "261313" and "software" both find the same
  // row.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all.slice(0, 40);
    return all
      .filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          o.anzsco2022.includes(q) ||
          o.anzsco2013.includes(q)
      )
      .slice(0, 40);
  }, [all, query]);

  const isOn = (o: OccupationChoice) => selected.some((s) => s.name === o.name);
  const toggle = (o: OccupationChoice) =>
    onChange(isOn(o) ? selected.filter((s) => s.name !== o.name) : [...selected, o]);

  return (
    <div className="field field-wide">
      <span className="label-text">
        ANZSCO occupation
        {selected.length > 0 && <span className="picker-count">{selected.length}</span>}
      </span>
      <span className="field-hint">
        A role can map to more than one. Each one you pick fills the occupation name and both
        ANZSCO codes.
      </span>

      {selected.length > 0 && (
        <ul className="picked-list">
          {selected.map((o) => (
            <li key={o.name}>
              <button type="button" className="active-chip" onClick={() => toggle(o)}>
                <span className="active-chip-field">{o.anzsco2022 || o.anzsco2013}</span>
                <span className="active-chip-value">{o.name}</span>
                <span className="active-chip-x" aria-hidden="true" />
                <span className="visually-hidden">Remove occupation</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        type="search"
        value={query}
        placeholder="Search by occupation or code"
        aria-label="Search occupations"
        onChange={(e) => setQuery(e.target.value)}
      />

      {all.length === 0 ? (
        <p className="field-hint">
          The occupation reference hasn't loaded. Run <code>npm run fetch-occupations</code>.
        </p>
      ) : (
        <ul className="check-list" role="group" aria-label="Occupations">
          {matches.map((o) => (
            <li key={o.name}>
              <label className="tag-check">
                <input type="checkbox" checked={isOn(o)} onChange={() => toggle(o)} />
                <span>
                  {o.name}
                  <span className="combo-code">{o.anzsco2022 || o.anzsco2013}</span>
                </span>
              </label>
            </li>
          ))}
          {matches.length === 0 && <li className="field-hint">No occupation matches that.</li>}
        </ul>
      )}
    </div>
  );
}
