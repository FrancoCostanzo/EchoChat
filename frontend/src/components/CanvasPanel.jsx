import { forwardRef } from 'react';

/* ─────────────────────────────────────────────────────────
   CanvasPanel — surface primitive of the "Spatial Canvas"
   design system. Every floating card (sidebar, chat, dock,
   member panel) is an instance of this, so depth stays
   consistent across the app instead of ad-hoc shadows.
   Spec: docs/SPATIAL_CANVAS.md
   ───────────────────────────────────────────────────────── */

const ELEVATION = {
  1: 'echo-e1',
  2: 'echo-e2',
  3: 'echo-e3',
};

const RADIUS = {
  lg: 'rounded-2xl',   /* 16px */
  xl: 'rounded-3xl',   /* 24px — hero surfaces (chat) */
};

/** Margins against the canvas — visible air between panels is part of the API */
const INSET = {
  none: '',
  sm: 'my-2',
  md: 'my-4',
  lg: 'my-6',
};

const CanvasPanel = forwardRef(function CanvasPanel(
  {
    as: Component = 'div',
    elevation = 2,
    glass = false,
    radius = 'lg',
    inset = 'none',
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
        INSET[inset] ?? '',
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
