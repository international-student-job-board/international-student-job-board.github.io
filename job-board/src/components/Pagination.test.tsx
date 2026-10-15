import { fireEvent, render, screen } from '@testing-library/react';
import { Pagination, pageItems, rangeLabel, GAP } from './Pagination';

describe('which page numbers are shown', () => {
  test('in the middle: five pages centred on this one, with "…" either side', () => {
    expect(pageItems(16, 255)).toEqual([GAP, 14, 15, 16, 17, 18, GAP]);
  });

  test('near the start: the first five, then "…"', () => {
    expect(pageItems(1, 25)).toEqual([1, 2, 3, 4, 5, GAP]);
    expect(pageItems(3, 25)).toEqual([1, 2, 3, 4, 5, GAP]);
  });

  test('near the end: "…", then the last five', () => {
    expect(pageItems(25, 25)).toEqual([GAP, 21, 22, 23, 24, 25]);
    expect(pageItems(23, 25)).toEqual([GAP, 21, 22, 23, 24, 25]);
  });

  test('the first and last pages are not numbered on their own - First and Last go there', () => {
    expect(pageItems(10, 25)).not.toContain(1);
    expect(pageItems(10, 25)).not.toContain(25);
  });

  test('a short list shows every page and never one that does not exist', () => {
    expect(pageItems(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageItems(4, 6)).toEqual([GAP, 2, 3, 4, 5, 6]);
    expect(pageItems(1, 2)).toEqual([1, 2]);
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(1, 0)).toEqual([]);
  });
});

test('the range reads "11–20 of 4,410", and the last page stops at the total', () => {
  expect(rangeLabel(2, 10, 4410)).toBe('11–20 of 4,410');
  expect(rangeLabel(3, 10, 25)).toBe('21–25 of 25');
});

describe('the pagination control', () => {
  const setup = (page: number, totalPages = 10, onPage = jest.fn()) => {
    render(
      <Pagination
        page={page}
        totalPages={totalPages}
        label="Job pages"
        hrefFor={(n) => (n === 1 ? '/' : `/?page=${n}`)}
        onPage={onPage}
      />
    );
    return onPage;
  };

  test('page 1 has nowhere to go back to - First and Back are not links', () => {
    setup(1);
    expect(screen.queryByRole('link', { name: /first/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /prev/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /next/i })).toHaveAttribute('href', '/?page=2');
    expect(screen.getByRole('link', { name: /last/i })).toHaveAttribute('href', '/?page=10');
    expect(screen.getByRole('link', { name: 'Page 5' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Page 10' })).not.toBeInTheDocument();
  });

  test('the last page has no Next or Last', () => {
    setup(10);
    expect(screen.getByRole('link', { name: /prev/i })).toHaveAttribute('href', '/?page=9');
    expect(screen.getByRole('link', { name: /first/i })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('link', { name: /next/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /last/i })).not.toBeInTheDocument();
  });

  test('a middle page links two pages either side, and First and Last', () => {
    setup(5, 20);
    expect(screen.getByRole('link', { name: /prev/i })).toHaveAttribute('href', '/?page=4');
    expect(screen.getByRole('link', { name: /first/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Page 3' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Page 7' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /last/i })).toHaveAttribute('href', '/?page=20');
    expect(screen.queryByRole('link', { name: 'Page 20' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Page 9' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /next/i })).toHaveAttribute('href', '/?page=6');
  });

  test('the current page is marked, and is not a link to itself', () => {
    setup(4);
    const current = screen.getByText('4', { selector: '[aria-current="page"]' });
    expect(current).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Page 4' })).not.toBeInTheDocument();
  });

  test('the first page keeps its clean address', () => {
    setup(2);
    expect(screen.getByRole('link', { name: /prev/i })).toHaveAttribute('href', '/');
  });

  test('a plain click changes the page in place', () => {
    const onPage = setup(4);
    const notPrevented = fireEvent.click(screen.getByRole('link', { name: 'Page 5' }));
    expect(onPage).toHaveBeenCalledWith(5);
    expect(notPrevented).toBe(false); // preventDefault was called: no navigation
  });

  test('a modified click is left to the browser, so "open in new tab" works', () => {
    const onPage = setup(4);
    fireEvent.click(screen.getByRole('link', { name: 'Page 5' }), { ctrlKey: true });
    fireEvent.click(screen.getByRole('link', { name: 'Page 5' }), { metaKey: true });
    fireEvent.click(screen.getByRole('link', { name: 'Page 5' }), { button: 1 });
    expect(onPage).not.toHaveBeenCalled();
  });

  test('a single page renders nothing at all', () => {
    setup(1, 1);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  test('a screen reader is told where it is', () => {
    setup(4);
    expect(screen.getByRole('navigation', { name: 'Job pages' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Page 4 of 10');
  });
});
