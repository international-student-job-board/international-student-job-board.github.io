import {
  OUTBOUND,
  outboundHref,
  OUTBOUND_ATTRS,
  emailApplyHref,
  safeHref,
} from './outbound';

describe('the outbound link contract', () => {
  test('keeps noopener but never noreferrer', () => {
    // The regression this guards: `noreferrer` strips the Referer header, so every site we
    // send traffic to loses all trace of where it came from.
    expect(OUTBOUND.rel).toBe('noopener');
    expect(OUTBOUND.rel).not.toContain('noreferrer');
    expect(OUTBOUND_ATTRS).not.toContain('noreferrer');
  });

  test('sends the origin, not the page the reader was on', () => {
    expect(OUTBOUND.referrerPolicy).toBe('strict-origin-when-cross-origin');
    expect(OUTBOUND_ATTRS).toContain('referrerpolicy="strict-origin-when-cross-origin"');
  });
});

describe('outboundHref', () => {
  test('tags a web link as referral traffic from this site', () => {
    const url = new URL(outboundHref('https://acme.test/careers', 'apply'));
    expect(url.searchParams.get('utm_source')).toBe(window.location.hostname);
    expect(url.searchParams.get('utm_medium')).toBe('referral');
    expect(url.searchParams.get('utm_campaign')).toBe('apply');
  });

  test('keeps the query string the destination already had', () => {
    const url = new URL(outboundHref('https://acme.test/jobs?id=7', 'apply'));
    expect(url.searchParams.get('id')).toBe('7');
    expect(url.pathname).toBe('/jobs');
  });

  test('replaces its own tags rather than stacking them up', () => {
    const once = outboundHref('https://acme.test/', 'apply');
    expect(outboundHref(once, 'apply')).toBe(once);
  });

  test('leaves mailto: and other non-web links alone', () => {
    expect(outboundHref('mailto:jobs@acme.test', 'apply')).toBe('mailto:jobs@acme.test');
    expect(outboundHref('/careers', 'apply')).toBe('/careers');
  });

  test('an unparseable link is passed through, never broken', () => {
    expect(outboundHref('https://', 'apply')).toBe('');
    expect(outboundHref('  ', 'apply')).toBe('');
  });
});

describe('emailApplyHref', () => {
  const SITE = 'International Student Job Board';
  const URL_ = 'https://example.test/';
  const body = (href: string) =>
    decodeURIComponent(new URLSearchParams(href.split('?')[1]).get('body') ?? '');
  const subject = (href: string) =>
    decodeURIComponent(new URLSearchParams(href.split('?')[1]).get('subject') ?? '');

  test('tells the employer where the applicant came from', () => {
    const href = emailApplyHref('mailto:jobs@acme.test', 'Graduate Engineer', SITE, URL_);
    expect(body(href)).toContain(SITE);
    expect(body(href)).toContain(URL_);
  });

  test('names the role in the subject when the employer gave none', () => {
    const href = emailApplyHref('mailto:jobs@acme.test', 'Graduate Engineer', SITE, URL_);
    expect(subject(href)).toBe('Application: Graduate Engineer');
  });

  test("keeps the employer's own subject rather than overwriting it", () => {
    const href = emailApplyHref(
      'mailto:jobs@acme.test?subject=Careers%20enquiry',
      'Graduate Engineer',
      SITE,
      URL_
    );
    expect(subject(href)).toBe('Careers enquiry');
  });

  test("adds to the employer's template body instead of replacing it", () => {
    const href = emailApplyHref(
      'mailto:jobs@acme.test?body=Name%3A%0AResume%3A',
      'Graduate Engineer',
      SITE,
      URL_
    );
    expect(body(href)).toContain('Name:');
    expect(body(href)).toContain(SITE);
  });

  test('other parameters like cc survive', () => {
    const href = emailApplyHref(
      'mailto:jobs@acme.test?cc=hr@acme.test',
      'Graduate Engineer',
      SITE,
      URL_
    );
    expect(href).toContain('cc=hr%40acme.test');
  });

  test('spaces are encoded as %20, which every mail client reads correctly', () => {
    const href = emailApplyHref('mailto:jobs@acme.test', 'Graduate Engineer', SITE, URL_);
    // A "+" here shows up literally in the message in several clients.
    expect(href).not.toContain('+');
  });

  test('a web apply link is left well alone', () => {
    expect(emailApplyHref('https://acme.test/apply', 'Role', SITE, URL_)).toBe(
      'https://acme.test/apply'
    );
  });
});

describe('safeHref', () => {
  test('allows the schemes a job board actually needs', () => {
    expect(safeHref('https://acme.test/apply')).toBe('https://acme.test/apply');
    expect(safeHref('http://acme.test')).toBe('http://acme.test');
    expect(safeHref('mailto:jobs@acme.test')).toBe('mailto:jobs@acme.test');
    expect(safeHref('#/jobs')).toBe('#/jobs');
  });

  test('refuses anything that can execute', () => {
    // Stored XSS if any of these reached an href: the data files are edited by hand and
    // generated from third-party exports.
    expect(safeHref('javascript:alert(1)')).toBe('');
    expect(safeHref('JavaScript:alert(1)')).toBe('');
    expect(safeHref('  javascript:alert(1)  ')).toBe('');
    expect(safeHref('data:text/html,<script>alert(1)</script>')).toBe('');
    expect(safeHref('vbscript:msgbox(1)')).toBe('');
  });

  test('an empty or unparseable value yields nothing to click', () => {
    expect(safeHref('')).toBe('');
    expect(safeHref('   ')).toBe('');
    expect(safeHref('not a url')).toBe('');
  });
});

test('outbound links inherit the scheme allowlist', () => {
  expect(outboundHref('javascript:alert(1)', 'apply')).toBe('');
  expect(emailApplyHref('javascript:alert(1)', 'Role', 'Site', 'https://s.test')).toBe('');
});

describe('destinations that are handed the URL untouched', () => {
  test('a LinkedIn job link is passed through exactly as given', () => {
    // These work from the live site either way; passing them through untouched
    // is what makes an apply link testable from localhost, where the request
    // arrives from an insecure non-public origin.
    const url = 'https://www.linkedin.com/jobs/view/4442983703/';
    expect(outboundHref(url, 'apply')).toBe(url);
  });

  test('any LinkedIn subdomain, and the company pages too', () => {
    expect(outboundHref('https://au.linkedin.com/jobs/view/1/', 'apply')).toBe(
      'https://au.linkedin.com/jobs/view/1/'
    );
    expect(outboundHref('https://www.linkedin.com/company/acme/', 'employer')).toBe(
      'https://www.linkedin.com/company/acme/'
    );
  });

  test('a host that merely ends in the same letters is still tagged', () => {
    // "notlinkedin.com" is not LinkedIn.
    expect(outboundHref('https://notlinkedin.com/x', 'apply')).toContain('utm_source');
  });

  test('every other destination is still tagged', () => {
    expect(outboundHref('https://jobs.lever.co/acme/1', 'apply')).toContain('utm_campaign=apply');
  });
});
