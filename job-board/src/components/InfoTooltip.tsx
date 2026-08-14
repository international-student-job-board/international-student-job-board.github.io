// Small "i" affordance that reveals explanatory text on hover or keyboard focus.
export function InfoTooltip({
  text,
  label,
  placement = 'top',
}: {
  text: string;
  label?: string;
  /**
   * Which way the bubble opens. Near the top of the page there is nothing above
   * to open into, so those say 'bottom'.
   */
  placement?: 'top' | 'bottom';
}) {
  return (
    <span className={`info-tip info-tip-${placement}`}>
      <button type="button" className="info-tip-btn" aria-label={label || 'More information'}>
        i
      </button>
      <span className="info-tip-bubble" role="tooltip">
        {text}
      </span>
    </span>
  );
}
