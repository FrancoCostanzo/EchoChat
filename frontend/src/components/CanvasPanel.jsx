import { forwardRef } from 'react';

/* ─────────────────────────────────────────────────────────
   CanvasPanel — surface primitive of the "Spatial Canvas"
   design system. Every floating card (sidebar, chat, dock,
   member panel) is an instance of this, so depth stays
   consistent across the app instead of ad-hoc shadows.
   ───────────────────────────────────────────────────────── */

const ELEVATION = {
  1: 'echo-e1',
  2: 'echo-e2',
  3: 'echo-e3',
};

const RADIUS = {
  lg: 'rounded-2xl',
  xl: 'rounded-3xl',
};

const CanvasPanel = forwardRef(function CanvasPanel(
  {
    as: Component = 'div',
    elevation = 2,
    glass = false,
    radius = 'lg',
    accentGlow = false,
    className = '',
    children,
    ...rest
  },
  ref,
) {
  return (
    <Component
      ref={ref}
      className={[
        glass ? 'echo-glass' : `echo-panel-solid ${ELEVATION[elevation] ?? ELEVATION[2]}`,
        RADIUS[radius] ?? RADIUS.lg,
        accentGlow ? 'echo-glow-accent' : '',
        'overflow-hidden',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </Component>
  );
});

export default CanvasPanel;
