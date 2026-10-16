import { CSSProperties, useCallback, useEffect, useRef, useState } from 'react';

/** As wide as the bubble ever gets, matching the max-width the stylesheet sets. */
const BUBBLE_WIDTH = 320;

/** How close to that edge counts as no longer having room. */
const MARGIN = 12;

type Align = 'center' | 'left' | 'right';

/**
 * Where the bubble hangs from, and how wide it may be once it is there - plus, for a tip inside
 * the filters dialog, where on the screen it goes (see FLOATING).
 */
type Placed = { align: Align; maxWidth?: number; fixed?: CSSProperties };

/**
 * Containers that clip in both directions and are no bigger than they need to be: the filters
 * dialog's scrolling body, and a dropdown panel floated over it, which hides its own overflow so
 * its option list can scroll. A bubble positioned inside one of those is cut off by its edge - the
 * sponsor and students tips lost their top half to the panel. Inside them the bubble is pinned to
 * the screen instead, at the button, so nothing it sits in can clip it.
 */
const FLOATING = '[data-overlay], [role="dialog"]';

/** How far the bubble stands off its button, matching the stylesheet's 10px. */
const GAP = 10;

/**
 * Overflow values that cut off whatever reaches past the edge. Listed the way
 * round that treats anything else as harmless: jsdom reports overflow as the
 * empty string, and reading that as "clips" would have every tooltip in the
 * tests measuring itself against a box of no width.
 */
const CLIPPING = ['auto', 'scroll', 'hidden', 'clip'];

/**
 * The box the bubble has to stay inside.
 *
 * Not the window. A tooltip in the job detail hangs inside a pane that scrolls,
 * and that pane clips it: measured against the window, a bubble near the pane's
 * left edge opened over the job list and was cut in half, and one near its right
 * edge pushed the pane wider and put a scrollbar under it. The window is only
 * the answer for a tip that isn't inside anything narrower.
 */
function boundsFor(button: HTMLElement) {
  let node = button.parentElement;
  while (node) {
    const style = getComputedStyle(node);
    if (CLIPPING.includes(style.overflowX)) {
      const inner = node.getBoundingClientRect().left + parseFloat(style.borderLeftWidth);
      return {
        left: inner + parseFloat(style.paddingLeft),
        right: inner + node.clientWidth - parseFloat(style.paddingRight),
      };
    }
    node = node.parentElement;
  }
  return { left: 0, right: window.innerWidth };
}

/**
 * Small "i" affordance that reveals explanatory text on hover, keyboard focus, or a tap.
 *
 * The bubble is centred on the button by default, which puts half of it past
 * the edge for anything near one - and the filters that most need explaining
 * sit at the ends of the row. So the edge it anchors to is chosen when it
 * opens, the same way the filter panel picks its own side: measure once, then
 * hang the bubble from whichever side has room. What counts as the edge is
 * whatever would clip it, which is usually not the window: see boundsFor.
 *
 * The measurement runs on hover and focus rather than on mount because a filter
 * panel moves - it opens, the row wraps, the pane resizes - and where the
 * button was at mount says nothing about where it is when someone reaches for
 * it.
 *
 * Opening is CSS-driven (hover / focus-within) for a mouse or keyboard, which
 * costs nothing in script - but there is no hover on a touch screen, so the
 * button also tracks its own open state and toggles it on tap. That state is
 * what makes a link inside the bubble reachable on mobile: without it, a tap
 * opens the bubble via focus but the very next tap (on the link) moves focus
 * onto the link and away from the button, which would close the bubble before
 * the tap on the link is even processed.
 */
export function InfoTooltip({
  text,
  link,
  label,
  placement = 'top',
}: {
  text: string;
  /** A source the note points to, rendered as a clickable line under the text. */
  link?: { label: string; href: string };
  label?: string;
  /**
   * Which way the bubble opens. Near the top of the page there is nothing above
   * to open into, so those say 'bottom'.
   */
  placement?: 'top' | 'bottom';
}) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [placed, setPlaced] = useState<Placed>({ align: 'center' });
  const [open, setOpen] = useState(false);

  const place = useCallback(() => {
    const button = buttonRef.current;
    // getBoundingClientRect doesn't exist in jsdom's minimal layout, and a
    // tooltip that can't measure should still open somewhere sensible.
    if (!button?.getBoundingClientRect) return;

    const rect = button.getBoundingClientRect();
    const { left, right } = rect;
    const centre = (left + right) / 2;
    const floating = Boolean(button.closest?.(FLOATING));
    const bounds = floating ? { left: 0, right: window.innerWidth } : boundsFor(button);
    const edge = { left: bounds.left + MARGIN, right: bounds.right - MARGIN };

    // How wide the bubble could be under each anchoring, given it grows away
    // from the point it is pinned to: from the button's left edge rightwards,
    // from its right edge leftwards, or from its centre both ways at once.
    const room = {
      center: 2 * Math.min(centre - edge.left, edge.right - centre),
      left: edge.right - left,
      right: right - edge.left,
    };

    // Centred is the best-looking, so it wins whenever it fits whole. Failing
    // that, the roomier side. In a pane too narrow for the full bubble even
    // then, the cap below is what keeps it inside instead of pushing the pane
    // wide enough to need scrolling.
    const align: Align =
      room.center >= BUBBLE_WIDTH ? 'center' : room.left >= room.right ? 'left' : 'right';
    const width = Math.min(BUBBLE_WIDTH, room[align], window.innerWidth * 0.8);

    // Pinned to the screen: the same edge the stylesheet would hang it from, given as a viewport
    // position, and opening the same way (above, or below for a 'bottom' tip).
    const fixed: CSSProperties | undefined = floating
      ? {
          position: 'fixed',
          ...(placement === 'bottom'
            ? { top: rect.bottom + GAP, bottom: 'auto' }
            : { bottom: window.innerHeight - rect.top + GAP, top: 'auto' }),
          ...(align === 'center'
            ? { left: centre }
            : align === 'left'
              ? { left }
              : { left: 'auto', right: window.innerWidth - right }),
        }
      : undefined;

    setPlaced({ align, maxWidth: width > 0 ? Math.round(width) : undefined, fixed });
  }, [placement]);

  // A tapped-open bubble closes on a tap outside it or Escape - it has no other way out, since
  // there's no hover to lose on a touch screen.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <span className={`info-tip info-tip-${placement}`} ref={rootRef} data-open={open || undefined}>
      <button
        type="button"
        ref={buttonRef}
        className="info-tip-btn"
        aria-label={label || 'More information'}
        aria-expanded={open}
        onMouseEnter={place}
        onFocus={place}
        onClick={() => {
          place();
          setOpen((was) => !was);
        }}
      >
        i
      </button>
      <span
        className="info-tip-bubble"
        role="tooltip"
        data-align={placed.align}
        style={
          placed.maxWidth || placed.fixed
            ? { ...placed.fixed, ...(placed.maxWidth ? { maxWidth: placed.maxWidth } : {}) }
            : undefined
        }
      >
        {text}
        {link && (
          <a
            className="info-tip-link"
            href={link.href}
            target="_blank"
            rel="noopener"
            referrerPolicy="strict-origin-when-cross-origin"
          >
            {link.label}
          </a>
        )}
      </span>
    </span>
  );
}
