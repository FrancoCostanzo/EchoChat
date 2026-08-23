import type { ComponentType } from 'react';
import { SearchX } from 'lucide-react';

interface NotFoundIconProps {
  /** Lucide icon component to display. */
  icon?: ComponentType<{ size?: number; strokeWidth?: number }>;
  /** Bold heading below the icon. */
  title?: string;
  /** Subtitle / helper text. */
  description?: string;
  iconSize?: number;
  className?: string;
}

/** Reusable empty-state component. */
export default function NotFoundIcon({
  icon: Icon = SearchX,
  title,
  description,
  iconSize = 44,
  className = '',
}: NotFoundIconProps) {
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
