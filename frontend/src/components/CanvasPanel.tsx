import { forwardRef, type ElementType, type ReactNode, type Ref, type ComponentPropsWithoutRef } from 'react';

/* ─────────────────────────────────────────────────────────
   CanvasPanel — surface primitive of the "Spatial Canvas"
   design system. Every floating card (sidebar, chat, dock,
   member panel) is an instance of this, so depth stays
   consistent across the app instead of ad-hoc shadows.
   Spec: docs/SPATIAL_CANVAS.md
   ───────────────────────────────────────────────────────── */

const ELEVATION: Record<number, string> = {
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

interface CanvasPanelOwnProps {
  as?: ElementType;
  elevation?: 1 | 2 | 3;
  glass?: boolean;
  radius?: keyof typeof RADIUS;
  inset?: keyof typeof INSET;
  accentGlow?: boolean;
  clip?: boolean;
  className?: string;
  children?: ReactNode;
}

// Polimórfico (el elemento real lo decide `as`): se acepta cualquier prop
// extra vía `...rest` como hacía la versión JS, sin angostar de más.
type CanvasPanelProps = CanvasPanelOwnProps & Omit<ComponentPropsWithoutRef<'div'>, keyof CanvasPanelOwnProps>;

const CanvasPanel = forwardRef(function CanvasPanel(
  {
    as: Component = 'div',
    elevation = 2,
    glass = false,
    radius = 'lg',
    inset = 'none',
    accentGlow = false,
    clip = true,
    className = '',
    children,
    ...rest
  }: CanvasPanelProps,
  ref: Ref<HTMLElement>,
) {
  return (
    <Component
      ref={ref}
      className={[
        glass ? 'echo-glass' : `echo-panel-solid ${ELEVATION[elevation] ?? ELEVATION[2]}`,
        RADIUS[radius] ?? RADIUS.lg,
        INSET[inset] ?? '',
        accentGlow ? 'echo-glow-accent' : '',
        clip ? 'overflow-hidden' : 'overflow-visible',
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
