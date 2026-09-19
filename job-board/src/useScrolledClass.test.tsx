import { useRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { SCROLLED_CLASS, useScrolledClass } from './useScrolledClass';

function Pane() {
  const ref = useRef<HTMLDivElement>(null);
  useScrolledClass(ref);
  return (
    <div ref={ref} data-testid="pane">
      role
    </div>
  );
}

const scrollTo = (el: HTMLElement, top: number) => {
  el.scrollTop = top;
  fireEvent.scroll(el);
};

describe('a pane that has been scrolled stays scrollable', () => {
  test('marked once it is scrolled away from the top, and unmarked back at the top', () => {
    render(<Pane />);
    const pane = screen.getByTestId('pane');
    expect(pane).not.toHaveClass(SCROLLED_CLASS);

    scrollTo(pane, 400);
    expect(pane).toHaveClass(SCROLLED_CLASS);

    scrollTo(pane, 0);
    expect(pane).not.toHaveClass(SCROLLED_CLASS);
  });

  test('stops listening when it is removed', () => {
    const { unmount } = render(<Pane />);
    const pane = screen.getByTestId('pane');
    const remove = jest.spyOn(pane, 'removeEventListener');
    unmount();
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function));
  });
});
