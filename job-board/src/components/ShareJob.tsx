import { useEffect, useState } from 'react';

const base = process.env.PUBLIC_URL || '';

/** Copies a link straight to this role. */
export function ShareJob({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  // The confirmation clears itself; leaving "Copied" up forever would say nothing about the
  // next click.
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Clipboard access can be refused (an insecure origin, or a browser setting).
      window.prompt(`Copy the link to ${title}:`, url);
    }
  };

  return (
    <button
      type="button"
      className={`share-btn${copied ? ' is-copied' : ''}`}
      onClick={copy}
      aria-live="polite"
    >
      <img
        className="share-btn-icon"
        src={`${base}/icons/share-button.svg`}
        alt=""
        aria-hidden="true"
        width={16}
        height={16}
      />
      {copied ? 'Link copied' : 'Share this role'}
    </button>
  );
}
