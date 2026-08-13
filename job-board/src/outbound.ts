// How this site hands a visitor over to somewhere else.

/** Schemes a link is allowed to use. */
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
 * Tags a destination with UTM parameters so it shows up in the receiving site's analytics
 * as referral traffic from us, belt-and-braces alongside the Referer header.
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
 * An emailed application, addressed as the employer asked but with a closing line saying
 * where the applicant found the role.
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
  // Built by hand rather than with URLSearchParams.toString(), which encodes a space as "+"
  // — several mail clients paste that straight into the message.
  const extra = Array.from(params.entries())
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  return (
    `mailto:${address}?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}` +
    (extra ? `&${extra}` : '')
  );
}
