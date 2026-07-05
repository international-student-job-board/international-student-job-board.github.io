import { formatDate } from '../format';
import { REPO_URL, FEEDBACK_URL, CONTACT_MAILTO } from '../links';

// Stamped at build time by the `build:pages` / `build` scripts; falls back to a
// fixed date during local dev where the env var isn't set.
const LAST_UPDATED = process.env.REACT_APP_BUILD_DATE || '2026-07-05';

export function Footer() {
  return (
    <footer className="site-footer">
      <p className="footer-copy">
        International Student Job Board · Last updated {formatDate(LAST_UPDATED)}
      </p>
      <nav className="footer-links" aria-label="Footer">
        {CONTACT_MAILTO && <a href={CONTACT_MAILTO}>Contact us</a>}
        <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer">
          Feedback &amp; feature requests
        </a>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
          View on GitHub
        </a>
      </nav>
    </footer>
  );
}
