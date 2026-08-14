import { trackPageView } from './analytics';

const META = {
  title: 'Graduate Software Engineer at Acme | International Student Job Board',
  description: 'x',
  url: 'https://example.test/jobs/7',
};

afterEach(() => {
  delete (window as { gtag?: unknown }).gtag;
});

describe('sending a page view', () => {
  test('it reports the address the app navigated to', () => {
    const gtag = jest.fn();
    (window as { gtag?: unknown }).gtag = gtag;

    trackPageView(META);

    expect(gtag).toHaveBeenCalledWith('event', 'page_view', {
      page_title: META.title,
      page_location: META.url,
      page_path: '/jobs/7',
    });
  });

  test('it does nothing when the tag is not there', () => {
    // Blocked script, local build, test run — analytics failing must never be
    // something the page notices.
    expect(() => trackPageView(META)).not.toThrow();
  });

  test('each address is reported separately', () => {
    const gtag = jest.fn();
    (window as { gtag?: unknown }).gtag = gtag;

    trackPageView({ ...META, url: 'https://example.test/' });
    trackPageView({ ...META, url: 'https://example.test/companies' });

    expect(gtag.mock.calls.map((c) => c[2].page_path)).toEqual(['/', '/companies']);
  });
});
