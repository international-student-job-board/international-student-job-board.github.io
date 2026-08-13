// Small "i" affordance that reveals explanatory text on hover or keyboard focus.
export function InfoTooltip({ text, label }: { text: string; label?: string }) {
  return (
    <span className="info-tip">
      <button type="button" className="info-tip-btn" aria-label={label || 'More information'}>
        i
      </button>
      <span className="info-tip-bubble" role="tooltip">
        {text}
      </span>
    </span>
  );
}
