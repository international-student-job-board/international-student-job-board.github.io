// How this site hands a visitor over to somewhere else.
//
// The pairing to know: `noopener` stops the opened page reaching back through
// `window.opener`, which is the security win. `noreferrer` does that too, but
// it also strips the Referer header — so a site we send traffic to has no idea
// the visit came from this board. We want them to know: an employer seeing
// applicants arrive from an international-student job board is the whole point
// of listing with us.
//
// So: `noopener` on its own, plus an explicit referrer policy. The policy sends
// our origin but not the path, so the destination learns which site sent them
// without learning which page the reader was on.

/**
 * Schemes a link is allowed to use. Everything on this site's pages is built
 * from data files — jobs.json, the companies CSV, occupations.json — so a URL
 * is only ever as trustworthy as whoever last edited those. A `javascript:`
 * href in any of them would run on click, which is stored XSS; an allowlist
 * costs nothing and closes it whatever the data says.
 */
const SAFE_SCHEMES = ['http:', 'https:', 'mailto:'];

/** The URL if it is safe to link to, otherwise an empty string. */
export function safeHref(url: string): string {
  const trimmed = (url ?? '').trim();
  if (!trimmed) return '';
  // Our own routes and anchors.
  if (/^[#/]/.test(trimmed)) return trimmed;
  try {
    return SAFE_SCHEMES.includes(new URL(trimmed).protocol) ? trimmed : '';
  } catch {
    return '';
  }
}

export const OUTBOUND = {
  target: '_blank',
  rel: 'noopener',
  referrerPolicy: 'strict-origin-when-cross-origin',
} as const;

/**
 * Tags a destination with UTM parameters so it shows up in the receiving site's
 * analytics as referral traffic from us, belt-and-braces alongside the Referer
 * header. Left untouched for mailto: and other non-web links, and for anything
 * that doesn't parse — a broken link is worse than an untagged one.
 */
export function outboundHref(url: string, campaign: string): string {
  const trimmed = safeHref(url);
  if (!/^https?:\/\//i.test(trimmed)) return trimmed;
  try {
    const parsed = new URL(trimmed);
    parsed.searchParams.set('utm_source', window.location.hostname);
    parsed.searchParams.set('utm_medium', 'referral');
    parsed.searchParams.set('utm_campaign', campaign);
    return parsed.toString();
  } catch {
    return trimmed;
  }
}

/** The same, for links built as raw HTML strings (the map popups). */
export const OUTBOUND_ATTRS =
  'target="_blank" rel="noopener" referrerpolicy="strict-origin-when-cross-origin"';

/**
 * An emailed application, addressed as the employer asked but with a closing
 * line saying where the applicant found the role.
 *
 * A `mailto:` apply link otherwise opens a blank message: the employer gets an
 * application with no idea it came from a board aimed at international
 * students, which is the one thing we most want them to know. A link in the
 * body is also the only signal that survives here — an email carries no Referer
 * header and no UTM tags.
 *
 * Anything the employer already put in the link (their own subject line, a
 * template body) is kept; this only adds to it.
 */
export function emailApplyHref(
  mailto: string,
  jobTitle: string,
  siteName: string,
  siteUrl: string
): string {
  const trimmed = safeHref(mailto);
  if (!/^mailto:/i.test(trimmed)) return trimmed;

  const [address, query = ''] = trimmed.slice('mailto:'.length).split('?');
  const params = new URLSearchParams(query);

  const subject = params.get('subject') || `Application: ${jobTitle}`;
  const existingBody = params.get('body');
  const credit = `I found this role on ${siteName}: ${siteUrl}`;
  const body = existingBody ? `${existingBody}\n\n${credit}` : `\n\n${credit}`;

  params.delete('subject');
  params.delete('body');
  // Built by hand rather than with URLSearchParams.toString(), which encodes a
  // space as "+" — several mail clients paste that straight into the message.
  const extra = Array.from(params.entries())
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  return (
    `mailto:${address}?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}` +
    (extra ? `&${extra}` : '')
  );
}
