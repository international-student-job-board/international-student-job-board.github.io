import { fireEvent, render, screen } from '@testing-library/react';
import { Pagination, pageWindow } from './Pagination';

describe('which page numbers are shown', () => {
  test('the first page shows 1 2 3', () => {
    expect(pageWindow(1, 10)).toEqual([1, 2, 3]);
  });

  test('the last page shows the page before it and itself', () => {
    expect(pageWindow(10, 10)).toEqual([9, 10]);
  });

  test('a page in the middle shows itself and both neighbours', () => {
    expect(pageWindow(4, 10)).toEqual([3, 4, 5]);
    expect(pageWindow(2, 10)).toEqual([1, 2, 3]);
    expect(pageWindow(9, 10)).toEqual([8, 9, 10]);
  });

  test('a short list never shows a page that does not exist', () => {
    expect(pageWindow(1, 2)).toEqual([1, 2]);
    expect(pageWindow(2, 2)).toEqual([1, 2]);
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(1, 0)).toEqual([]);
  });

  test('the control is the same width on page 2 as on page 200', () => {
    expect(pageWindow(200, 500)).toHaveLength(pageWindow(2, 500).length);
  });
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

  test('page 1 reads "1 2 3 Next" - there is nothing before it to go back to', () => {
    setup(1);
    expect(screen.queryByRole('link', { name: /prev/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /next/i })).toHaveAttribute('href', '/?page=2');
    expect(screen.getByRole('link', { name: 'Page 2' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Page 3' })).toBeInTheDocument();
  });

  test('the last page reads "Prev 9 10" - and no Next', () => {
    setup(10);
    expect(screen.getByRole('link', { name: /prev/i })).toHaveAttribute('href', '/?page=9');
    expect(screen.getByRole('link', { name: 'Page 9' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /next/i })).not.toBeInTheDocument();
  });

  test('a middle page reads "Prev 3 4 5 Next"', () => {
    setup(4);
    expect(screen.getByRole('link', { name: /prev/i })).toHaveAttribute('href', '/?page=3');
    expect(screen.getByRole('link', { name: 'Page 3' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Page 5' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /next/i })).toHaveAttribute('href', '/?page=5');
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
