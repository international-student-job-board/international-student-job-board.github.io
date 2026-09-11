import { ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/** Keeps the latest callback reachable from an effect without making it a dep —
 * the parent hands us a fresh `onClose` on every render, and re-running the
 * open effect for that would steal focus back into the dialog mid-interaction. */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onClear: () => void;
  /** The count the "Show N …" button reports. */
  resultCount: number;
  /** Singular noun for the count — "role", "company". */
  resultNoun?: string;
  /** Its plural, where a trailing "s" is wrong ("companies"). */
  resultNounPlural?: string;
  children: ReactNode;
}

/**
 * The "More filters" dialog — a full-height sheet on a phone, a centred panel on
 * a wide screen. The sections it holds are passed in as children, so the jobs
 * and companies pages build the same shell around their own filters.
 */
export function FiltersModal({
  open,
  onClose,
  onClear,
  resultCount,
  resultNoun = 'role',
  resultNounPlural,
  children,
}: Props) {
  const plural = resultNounPlural ?? `${resultNoun}s`;
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useLatest(onClose);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === dialogRef.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
    // `open` is the only real trigger — see useLatest above for why onClose isn't a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fmodal-overlay" onMouseDown={onClose}>
      <div
        className="fmodal"
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
        tabIndex={-1}
        ref={dialogRef}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="fmodal-head">
          <h2>Filters</h2>
          <button type="button" className="fmodal-close" onClick={onClose} aria-label="Close filters">
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="fmodal-body">{children}</div>

        <footer className="fmodal-foot">
          <button type="button" className="fmodal-clear" onClick={onClear}>
            Clear all
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Show {resultCount} {resultCount === 1 ? resultNoun : plural}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}

/** One titled block inside the modal — same spacing/heading treatment on both pages. */
export function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="fmodal-section">
      <h3>{title}</h3>
      <div className="fmodal-section-controls">{children}</div>
    </section>
  );
}
