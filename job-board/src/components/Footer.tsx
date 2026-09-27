import { formatDate } from '../format';
import { BUILD_DATE } from '../buildInfo';
import { FEEDBACK_URL, CONTACT_MAILTO, KOFI_URL } from '../links';
import { OUTBOUND, outboundHref } from '../outbound';

const base = process.env.PUBLIC_URL || '';

export function Footer() {
  return (
    <footer className="site-footer">
      <p className="footer-copy">
        International Student Job Board · Last updated {formatDate(BUILD_DATE)}
      </p>
      <nav className="footer-links" aria-label="Footer">
        <a
          href={FEEDBACK_URL}
          target="_blank"
          rel="noopener"
          referrerPolicy="strict-origin-when-cross-origin"
        >
          Feedback &amp; feature requests
        </a>
        {CONTACT_MAILTO && <a href={CONTACT_MAILTO}>Contact us</a>}
        <a className="footer-kofi" href={outboundHref(KOFI_URL, 'footer')} {...OUTBOUND}>
          <img
            className="footer-kofi-icon"
            src={`${base}/icons/coffee.svg`}
            alt=""
            aria-hidden="true"
            width={16}
            height={16}
          />
          Shout us a coffee
        </a>
      </nav>
    </footer>
  );
}
