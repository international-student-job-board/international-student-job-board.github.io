import { MouseEvent, ReactNode } from 'react';

/** A run of pages left out of the control, drawn as "…". */
export const GAP = 'gap' as const;
export type PageItem = number | typeof GAP;

/** How many pages either side of the current one are shown - two, so five in a row. */
const SIBLINGS = 2;
const WINDOW = SIBLINGS * 2 + 1;

/**
 * The page numbers to show: five pages centred on the current one, with "…" either side where
 * there are pages beyond them - `… 14 15 16 17 18 …`. The first and last pages aren't numbered
 * on their own: First and Last already go there.
 *
 * Near either end the five slide inwards rather than shrinking (`1 2 3 4 5 …`), so there are
 * always five in a row.
 */
export function pageItems(page: number, totalPages: number): PageItem[] {
  if (totalPages < 1) return [];
  const current = Math.min(Math.max(page, 1), totalPages);
  const from = Math.max(1, Math.min(current - SIBLINGS, totalPages - WINDOW + 1));
  const to = Math.min(totalPages, from + WINDOW - 1);

  const items: PageItem[] = [];
  if (from > 1) items.push(GAP);
  for (let n = from; n <= to; n += 1) items.push(n);
  if (to < totalPages) items.push(GAP);
  return items;
}

/** "11–20 of 4,410" - which of the results this page holds. */
export function rangeLabel(page: number, pageSize: number, total: number): string {
  const fmt = (n: number) => n.toLocaleString('en-AU');
  if (total <= 0) return '0 of 0';
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return `${fmt(first)}–${fmt(last)} of ${fmt(total)}`;
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

/** The four steps' chevrons - one for Back/Next, two for First/Last - pointing right; Back and
 * First flip them. Drawn rather than typed so they sit on the same line as the numbers. */
function Chevron({ double = false, left = false }: { double?: boolean; left?: boolean }) {
  return (
    <svg
      className="page-chevron"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
      style={left ? { transform: 'scaleX(-1)' } : undefined}
    >
      {double ? <path d="M4 4l4 4-4 4M9 4l4 4-4 4" /> : <path d="M6 4l4 4-4 4" />}
    </svg>
  );
}

/**
 * `«  ‹   … 14 15 16 17 18 …   ›  »` - a quiet row of links under the list, not a toolbar.
 *
 * Paging is a tertiary action here - the roles are what the page is for - so it is styled like
 * links rather than buttons (Refactoring UI, "Semantics are secondary"): no borders, the numbers
 * in the muted grey until hovered, and the steps as chevrons. The one thing given weight is the
 * page you are on, set apart by de-emphasising everything around it rather than by a heavy fill.
 * The steps stay in place, greyed out, where there is nowhere to go, so the numbers don't shift
 * sideways as the reader pages through.
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

  /** One of the four steps - a link, or a greyed-out placeholder where there is nowhere to go. */
  const step = (target: number, enabled: boolean, text: string, icon: ReactNode, rel?: string) =>
    enabled ? (
      <a
        className="page-step"
        href={hrefFor(target)}
        rel={rel}
        aria-label={text}
        title={text}
        onClick={go(target)}
      >
        {icon}
      </a>
    ) : (
      <span className="page-step is-disabled" aria-hidden="true">
        {icon}
      </span>
    );

  return (
    <nav className="pagination" aria-label={label}>
      <span className="page-steps">
        {step(1, current > 1, 'First page', <Chevron double left />)}
        {step(current - 1, current > 1, 'Previous page', <Chevron left />, 'prev')}
      </span>

      <span className="page-nums">
        {pageItems(current, totalPages).map((item, i) =>
          item === GAP ? (
            <span key={`gap-${i}`} className="page-gap" aria-hidden="true">
              …
            </span>
          ) : item === current ? (
            <span key={item} className="page-num is-current" aria-current="page">
              <span className="visually-hidden">Page </span>
              {item}
            </span>
          ) : (
            <a
              key={item}
              className="page-num"
              href={hrefFor(item)}
              aria-label={`Page ${item}`}
              onClick={go(item)}
            >
              {item}
            </a>
          )
        )}
      </span>

      <span className="page-steps">
        {step(current + 1, current < totalPages, 'Next page', <Chevron />, 'next')}
        {step(totalPages, current < totalPages, 'Last page', <Chevron double />)}
      </span>

      <span className="visually-hidden" role="status">
        Page {current} of {totalPages}
      </span>
    </nav>
  );
}
