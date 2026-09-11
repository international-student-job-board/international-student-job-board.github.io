import { ReactNode, useState } from 'react';

interface Props {
  /** How many filters are narrowing the list right now — shown as a badge so the
   * count is visible even while the section is closed. */
  activeCount: number;
  /** Open on first render? Closed by default, to keep the results the focus. */
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * The "Filters" open/close header that sits above the filter bar on both the
 * jobs board and the companies page — one collapsible section, same behaviour on
 * each. The bar (search, quick filters, "More filters", active chips) is the
 * `children`; it mounts only while open.
 */
export function FiltersDisclosure({ activeCount, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <>
      <button
        type="button"
        className="filters-toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Filters
        {activeCount > 0 && (
          <span className="filters-toggle-count">
            {activeCount}
            <span className="visually-hidden"> active</span>
          </span>
        )}
      </button>
      {open && children}
    </>
  );
}
