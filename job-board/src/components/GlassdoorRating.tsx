import { ReactNode } from 'react';
import { Company } from '../types';
import { glassdoorUrl } from '../references';
import { OUTBOUND, outboundHref } from '../outbound';

const STAR = (
  <svg
    className="glassdoor-star"
    viewBox="0 0 640 640"
    width={13}
    height={13}
    aria-hidden="true"
    focusable="false"
  >
    <path
      fill="currentColor"
      d="M341.5 45.1C337.4 37.1 329.1 32 320.1 32C311.1 32 302.8 37.1 298.7 45.1L225.1 189.3L65.2 214.7C56.3 216.1 48.9 222.4 46.1 231C43.3 239.6 45.6 249 51.9 255.4L166.3 369.9L141.1 529.8C139.7 538.7 143.4 547.7 150.7 553C158 558.3 167.6 559.1 175.7 555L320.1 481.6L464.4 555C472.4 559.1 482.1 558.3 489.4 553C496.7 547.7 500.4 538.8 499 529.8L473.7 369.9L588.1 255.4C594.5 249 596.7 239.6 593.9 231C591.1 222.4 583.8 216.1 574.8 214.7L415 189.3L341.5 45.1z"
    />
  </svg>
);

/**
 * "★ 4.0 based on 36 reviews on Glassdoor", the whole line linking to the
 * company's Glassdoor Overview page (tagged as referral traffic from us, like
 * the apply links). Falls back to plain text when we have the rating but no
 * page link, and renders nothing when the company isn't matched on Glassdoor.
 */
export function GlassdoorRating({
  company,
  className,
  showSource = true,
}: {
  company: Company;
  className?: string;
  /** Append " on Glassdoor" — off where a label ("Employer rating") already says so. */
  showSource?: boolean;
}) {
  const rating = company.glassdoorRating;
  if (!rating) return null;

  const url = glassdoorUrl(company.glassdoorUrl);
  const href = url ? outboundHref(url, 'glassdoor') : '';
  const reviews = company.glassdoorReviews;
  const reviewsText = reviews
    ? ` based on ${reviews.toLocaleString('en-AU')} ${reviews === 1 ? 'review' : 'reviews'}`
    : '';

  const cls = `glassdoor-rating${className ? ` ${className}` : ''}`;
  const body: ReactNode = (
    <>
      {STAR}{' '}
      {rating.toFixed(1)}
      {reviewsText}
      {showSource ? ' on Glassdoor' : ''}
    </>
  );

  return href ? (
    <a className={cls} href={href} {...OUTBOUND}>
      {body}
    </a>
  ) : (
    <span className={cls}>{body}</span>
  );
}
