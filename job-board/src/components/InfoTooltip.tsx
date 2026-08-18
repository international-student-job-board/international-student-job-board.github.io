import { useCallback, useRef, useState } from 'react';

/** As wide as the bubble ever gets, matching the max-width the stylesheet sets. */
const BUBBLE_WIDTH = 320;

/** How close to that edge counts as no longer having room. */
const MARGIN = 12;

type Align = 'center' | 'left' | 'right';

/** Where the bubble hangs from, and how wide it may be once it is there. */
type Placed = { align: Align; maxWidth?: number };

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
 * Small "i" affordance that reveals explanatory text on hover or keyboard focus.
 *
 * The bubble is centred on the button by default, which puts half of it past
 * the edge for anything near one — and the filters that most need explaining
 * sit at the ends of the row. So the edge it anchors to is chosen when it
 * opens, the same way the filter panel picks its own side: measure once, then
 * hang the bubble from whichever side has room. What counts as the edge is
 * whatever would clip it, which is usually not the window: see boundsFor.
 *
 * The measurement runs on hover and focus rather than on mount because a filter
 * panel moves — it opens, the row wraps, the pane resizes — and where the
 * button was at mount says nothing about where it is when someone reaches for
 * it.
 */
export function InfoTooltip({
  text,
  label,
  placement = 'top',
}: {
  text: string;
  label?: string;
  /**
   * Which way the bubble opens. Near the top of the page there is nothing above
   * to open into, so those say 'bottom'.
   */
  placement?: 'top' | 'bottom';
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [placed, setPlaced] = useState<Placed>({ align: 'center' });

  const place = useCallback(() => {
    const button = buttonRef.current;
    // getBoundingClientRect doesn't exist in jsdom's minimal layout, and a
    // tooltip that can't measure should still open somewhere sensible.
    if (!button?.getBoundingClientRect) return;

    const { left, right } = button.getBoundingClientRect();
    const centre = (left + right) / 2;
    const bounds = boundsFor(button);
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

    setPlaced({ align, maxWidth: width > 0 ? Math.round(width) : undefined });
  }, []);

  return (
    <span className={`info-tip info-tip-${placement}`}>
      <button
        type="button"
        ref={buttonRef}
        className="info-tip-btn"
        aria-label={label || 'More information'}
        onMouseEnter={place}
        onFocus={place}
      >
        i
      </button>
      <span
        className="info-tip-bubble"
        role="tooltip"
        data-align={placed.align}
        style={placed.maxWidth ? { maxWidth: placed.maxWidth } : undefined}
      >
        {text}
      </span>
    </span>
  );
}
