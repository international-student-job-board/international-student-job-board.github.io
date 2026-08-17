import { useCallback, useRef, useState } from 'react';

/** Roughly the bubble's width, so the edge it anchors to can be picked. */
const BUBBLE_WIDTH = 320;

/** How close to the window edge counts as no longer having room. */
const MARGIN = 12;

type Align = 'center' | 'left' | 'right';

/**
 * Small "i" affordance that reveals explanatory text on hover or keyboard focus.
 *
 * The bubble is centred on the button by default, which puts half of it off
 * screen for anything near an edge — and the filters that most need explaining
 * sit at the ends of the row. So the edge it anchors to is chosen when it
 * opens, the same way the filter panel picks its own side: measure once, then
 * hang the bubble from whichever side has room.
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
  const [align, setAlign] = useState<Align>('center');

  const place = useCallback(() => {
    const button = buttonRef.current;
    // getBoundingClientRect doesn't exist in jsdom's minimal layout, and a
    // tooltip that can't measure should still open somewhere sensible.
    if (!button?.getBoundingClientRect) return;

    const { left, right } = button.getBoundingClientRect();
    const centre = (left + right) / 2;
    const half = BUBBLE_WIDTH / 2;

    if (centre - half < MARGIN) setAlign('left');
    else if (centre + half > window.innerWidth - MARGIN) setAlign('right');
    else setAlign('center');
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
      <span className="info-tip-bubble" role="tooltip" data-align={align}>
        {text}
      </span>
    </span>
  );
}
