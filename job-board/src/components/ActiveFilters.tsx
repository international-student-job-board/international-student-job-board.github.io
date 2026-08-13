/**
 * The row of "you have narrowed by this" chips, shared by the jobs board and
 * the companies page.
 *
 * It was written once for the jobs filters, which left the companies page with
 * a bare "Clear filters" count and no way to see or undo one choice at a time —
 * two pages doing the same job two different ways. Refactoring UI is blunt
 * about that (p.22): mixing two treatments in one interface almost always looks
 * worse than committing to either, and the same holds for behaviour.
 *
 * A chip rather than a count, because a count only tells you *that* something
 * is narrowing the list; the reader still has to reopen every dropdown to find
 * out what. The chips answer it at a glance and each undoes only itself.
 */
export interface ActiveChip {
  id: string;
  /** Which filter it came from — "Industry", "Stage". */
  field: string;
  value: string;
  remove: () => void;
}

export function ActiveFilters({ chips, onClear }: { chips: ActiveChip[]; onClear: () => void }) {
  if (!chips.length) return null;

  return (
    <div className="active-filters">
      <h2 className="visually-hidden">Active filters</h2>
      <ul className="active-chips">
        {chips.map((chip) => (
          <li key={chip.id}>
            <button
              type="button"
              className="active-chip"
              onClick={chip.remove}
              title={`${chip.field}: ${chip.value}`}
            >
              <span className="active-chip-field">{chip.field}</span>
              <span className="active-chip-value">{chip.value}</span>
              <span className="active-chip-x" aria-hidden="true" />
              <span className="visually-hidden">Remove filter</span>
            </button>
          </li>
        ))}
      </ul>

      <button type="button" className="filter-clear" onClick={onClear}>
        Clear all
        <span className="filter-clear-count">{chips.length}</span>
      </button>
    </div>
  );
}
