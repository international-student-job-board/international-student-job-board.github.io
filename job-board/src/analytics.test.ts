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
    // Blocked script, local build, test run - analytics failing must never be
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

describe('sending events', () => {
  const { trackEvent, changedFilters, trackFilterChange, jobParams } =
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('./analytics') as typeof import('./analytics');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { EMPTY_FILTERS } = require('./jobFilters') as typeof import('./jobFilters');

  test('an event goes to the tag with its parameters', () => {
    const gtag = jest.fn();
    (window as { gtag?: unknown }).gtag = gtag;
    trackEvent('apply_click', { company: 'Acme' });
    expect(gtag).toHaveBeenCalledWith('event', 'apply_click', { company: 'Acme' });
  });

  test('and does nothing, quietly, when the tag is not there', () => {
    expect(() => trackEvent('apply_click')).not.toThrow();
  });

  test('filters that changed are reported one value at a time, added or removed', () => {
    const before = { ...EMPTY_FILTERS, jobLocations: ['Melbourne, Victoria'], sponsor: ['yes'] };
    const after = {
      ...EMPTY_FILTERS,
      jobLocations: ['Sydney, New South Wales'],
      sponsor: ['yes'],
      salaryMin: 90000,
    };
    expect(changedFilters(before, after)).toEqual([
      { name: 'jobLocations', value: 'Sydney, New South Wales', action: 'add' },
      { name: 'jobLocations', value: 'Melbourne, Victoria', action: 'remove' },
      { name: 'salaryMin', value: '90000', action: 'add' },
    ]);
  });

  test('the search box is not a filter change - it is reported as a search', () => {
    expect(changedFilters(EMPTY_FILTERS, { ...EMPTY_FILTERS, query: 'react' })).toEqual([]);
  });

  test('nothing changed, nothing sent', () => {
    const gtag = jest.fn();
    (window as { gtag?: unknown }).gtag = gtag;
    trackFilterChange(EMPTY_FILTERS, EMPTY_FILTERS);
    expect(gtag).not.toHaveBeenCalled();
  });

  test('a blank value is named, not sent empty', () => {
    const gtag = jest.fn();
    (window as { gtag?: unknown }).gtag = gtag;
    trackFilterChange(EMPTY_FILTERS, { ...EMPTY_FILTERS, jobLevels: [''] });
    expect(gtag).toHaveBeenCalledWith('event', 'filter_change', {
      filter_name: 'jobLevels',
      filter_value: '(blank)',
      action: 'add',
    });
  });

  test('a role is described by what people will want to ask of it, never who looked', () => {
    const job = {
      id: '7',
      type: 'Sales',
      location: 'Melbourne, Victoria',
      company: { name: 'Acme', accreditedSponsor: true },
    } as never;
    expect(jobParams(job)).toEqual({
      job_id: '7',
      company: 'Acme',
      job_type: 'Sales',
      job_location: 'Melbourne, Victoria',
      sponsor: 'yes',
    });
  });
});
