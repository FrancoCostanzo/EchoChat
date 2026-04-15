import { SearchX } from 'lucide-react';

/**
 * Reusable empty-state component.
 *
 * @param {React.ElementType} [icon=SearchX]  - Lucide icon component to display.
 * @param {string}            [title]         - Bold heading below the icon.
 * @param {string}            [description]   - Subtitle / helper text.
 * @param {number}            [iconSize=44]   - Size passed to the icon.
 * @param {string}            [className]     - Extra classes for the wrapper.
 */
export default function NotFoundIcon({
  icon: Icon = SearchX,
  title,
  description,
  iconSize = 44,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center gap-3 py-10 text-muted ${className}`}>
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-default">
        <Icon size={iconSize} strokeWidth={1.2} />
      </div>

      {title && (
        <p className="text-sm font-semibold text-foreground">{title}</p>
      )}

      {description && (
        <p className="max-w-xs text-center text-xs">{description}</p>
      )}
    </div>
  );
}
