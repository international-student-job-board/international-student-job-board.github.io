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
 * Hosts that are handed the URL exactly as it was given.
 *
 * LinkedIn is the only one so far, and it is here for local development rather
 * than for production: two thirds of the board's apply links are
 * linkedin.com/jobs/view/… pages, and they open fine from the live site with
 * the parameters attached. From localhost they don't — that request arrives
 * with utm_source=localhost and Referer: http://localhost:3000/, an insecure
 * non-public origin, and LinkedIn sends signed-out visitors to its login wall
 * instead of the job.
 *
 * Passing LinkedIn URLs through untouched makes an apply link testable locally,
 * and costs nothing: the page belongs to LinkedIn, so the employer never sees
 * the campaign anyway, and the Referer header still says where the visitor came
 * from.
 */
const UNTAGGED_HOSTS = ['linkedin.com'];

const isUntagged = (hostname: string) =>
  UNTAGGED_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));

/**
 * Tags a destination with UTM parameters so it shows up in the receiving site's analytics
 * as referral traffic from us, belt-and-braces alongside the Referer header.
 */
export function outboundHref(url: string, campaign: string): string {
  const trimmed = safeHref(url);
  if (!/^https?:\/\//i.test(trimmed)) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (isUntagged(parsed.hostname.toLowerCase())) return trimmed;
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
