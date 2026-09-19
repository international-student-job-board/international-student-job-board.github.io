import { MouseEvent } from 'react';

/**
 * The page numbers to show: the current page and its neighbours, so `3 4 5` around 4.
 *
 * At the ends there is only one side to look at, so the window keeps its shape by leaning the
 * other way rather than shrinking: page 1 shows `1 2 3`, the last page shows the last two.
 * The numbers stop at the neighbours rather than running the whole way, so the control is the
 * same width on page 2 as on page 200 - which is what lets it sit in one place on the screen.
 */
export function pageWindow(page: number, totalPages: number): number[] {
  if (totalPages < 1) return [];
  const current = Math.min(Math.max(page, 1), totalPages);
  const first =
    current === 1 ? 1 : current === totalPages ? Math.max(1, totalPages - 1) : current - 1;
  const last = current === 1 ? Math.min(3, totalPages) : Math.min(current + 1, totalPages);
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

interface Props {
  page: number;
  totalPages: number;
  /** What the control is called to a screen reader: "Job pages", "Company pages". */
  label: string;
  /** The address of a page, so each control is a real link that can be opened in a new tab,
   * copied, or followed by a crawler - not a button that only works from inside the app. */
  hrefFor: (page: number) => string;
  onPage: (page: number) => void;
}

/**
 * `‹ Prev  3  4  5  Next ›`, with the current page marked and Prev/Next left out where there is
 * nowhere to go.
 *
 * Every control is an anchor. Only a plain left click is taken over to change the page in
 * place; a modified click, middle-click or "open in new tab" is left to the browser, same as
 * the job cards.
 */
export function Pagination({ page, totalPages, label, hrefFor, onPage }: Props) {
  if (totalPages <= 1) return null;
  const current = Math.min(Math.max(page, 1), totalPages);

  const go = (target: number) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onPage(target);
  };

  return (
    <nav className="pagination" aria-label={label}>
      {current > 1 && (
        <a className="page-step" href={hrefFor(current - 1)} rel="prev" onClick={go(current - 1)}>
          <span aria-hidden="true">‹</span> Prev
        </a>
      )}

      {pageWindow(current, totalPages).map((n) =>
        n === current ? (
          <span key={n} className="page-num is-current" aria-current="page">
            <span className="visually-hidden">Page </span>
            {n}
          </span>
        ) : (
          <a
            key={n}
            className="page-num"
            href={hrefFor(n)}
            aria-label={`Page ${n}`}
            onClick={go(n)}
          >
            {n}
          </a>
        )
      )}

      {current < totalPages && (
        <a className="page-step" href={hrefFor(current + 1)} rel="next" onClick={go(current + 1)}>
          Next <span aria-hidden="true">›</span>
        </a>
      )}

      <span className="visually-hidden" role="status">
        Page {current} of {totalPages}
      </span>
    </nav>
  );
}
