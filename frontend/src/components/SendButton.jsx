import { Send } from 'lucide-react';

/**
 * Animated send button.
 * On hover the paper-plane icon flies forward; any label text slides out.
 * Styles live in the `.send-btn` CSS class defined in index.css.
 *
 * @param {function} onPress    - Click handler.
 * @param {boolean}  isDisabled - Disables the button.
 * @param {string}   [label]    - Optional visible label (e.g. "Send").
 * @param {string}   [className]- Extra classes for the root button.
 */
export default function SendButton({ onPress, isDisabled, label, className = '', pulse = false }) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={isDisabled}
      aria-label={label || undefined}
      className={`send-btn ${pulse ? 'send-btn--pulse' : ''} ${className}`.trim()}
    >
      <div className="send-svg-wrapper-1">
        <div className="send-svg-wrapper">
          <Send size={18} className="send-icon" />
        </div>
      </div>

      {label && <span className="send-label">{label}</span>}
    </button>
  );
}
