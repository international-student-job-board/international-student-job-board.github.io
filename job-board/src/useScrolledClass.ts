import { RefObject, useEffect } from 'react';

/** The class on an element that has been scrolled away from its top. */
export const SCROLLED_CLASS = 'is-scrolled';

/**
 * Marks an element with `is-scrolled` while it is scrolled away from its top.
 *
 * The role pane locks its own scrolling until it is pinned under the header (see .detail-scroll in
 * App.css). Without this, a reader who scrolled down inside the pinned pane and then scrolled the
 * page back up left it parked at the bottom of the advert and locked: the way back up was gone.
 * A pane that is scrolled has to stay scrollable; one at its top has nothing to scroll back to,
 * and can safely leave the wheel to the page.
 */
export function useScrolledClass(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => el.classList.toggle(SCROLLED_CLASS, el.scrollTop > 0);
    el.addEventListener('scroll', update, { passive: true });
    update();
    return () => el.removeEventListener('scroll', update);
  }, [ref]);
}
