import { Send } from 'lucide-react';

interface SendButtonProps {
  onPress: () => void;
  isDisabled?: boolean;
  /** Optional visible label (e.g. "Send"). */
  label?: string;
  className?: string;
  pulse?: boolean;
}

/**
 * Animated send button.
 * On hover the paper-plane icon flies forward; any label text slides out.
 * Styles live in the `.send-btn` CSS class defined in index.css.
 */
export default function SendButton({ onPress, isDisabled, label, className = '', pulse = false }: SendButtonProps) {
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
