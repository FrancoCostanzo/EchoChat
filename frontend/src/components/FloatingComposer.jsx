import { useState, useCallback } from 'react';

/* ─────────────────────────────────────────────────────────
   FloatingComposer — message input as a floating object
   inside the chat card (Spatial Canvas). Elevation rises on
   focus for micro-feedback while typing.
   Spec: docs/SPATIAL_CANVAS.md
   ───────────────────────────────────────────────────────── */

export default function FloatingComposer({
  channelAccent,
  elevationOnFocus = true,
  className = '',
  footer,
  children,
}) {
  const [focused, setFocused] = useState(false);

  const onFocusCapture = useCallback(() => setFocused(true), []);
  const onBlurCapture = useCallback((e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
  }, []);

  const accentStyle = channelAccent
    ? { '--composer-accent': channelAccent }
    : undefined;

  return (
    <div className={`px-2 pb-4 pt-1 sm:px-3 sm:pb-6 md:pb-4 ${className}`}>
      <div
        className={[
          'echo-glass echo-composer flex min-h-[44px] w-full min-w-0 items-stretch gap-1 overflow-visible rounded-2xl px-1 sm:gap-2 sm:px-2',
          elevationOnFocus && focused ? 'echo-e2 echo-composer-focused' : 'echo-e1',
        ].join(' ')}
        style={accentStyle}
        onFocusCapture={onFocusCapture}
        onBlurCapture={onBlurCapture}
      >
        {children}
      </div>
      {footer}
    </div>
  );
}
