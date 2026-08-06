import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';
import { SPRING_BOUNCY } from '@/lib/motion';

const SIZES = {
  xs: { box: 'h-5 w-5', px: 20, rounded: 'rounded-md' },
  sm: { box: 'h-9 w-9', px: 36, rounded: 'rounded-xl' },
  md: { box: 'h-14 w-14', px: 56, rounded: 'rounded-2xl' },
  lg: { box: 'h-28 w-28', px: 112, rounded: 'rounded-3xl' },
};

/** Same seven bars as the static mark (see docs brand assets) — center-aligned so each grows outward from the middle. */
const MARK_BARS = [
  { h: 0.3 },
  { h: 0.52 },
  { h: 0.74 },
  { h: 0.58 },
  { h: 1, accent: true },
  { h: 0.66 },
  { h: 0.36 },
];

/**
 * Animated waveform version of the app mark. `loop` plays a gentle
 * continuous pulse (loading states); otherwise it plays once and settles
 * (brand intros). Respects prefers-reduced-motion by rendering the static
 * final frame.
 */
export function AnimatedLogoMark({ loop = false, className = '' }) {
  const reducedMotion = useReducedMotion();

  return (
    <div
      className={['flex items-center gap-[6%]', className].filter(Boolean).join(' ')}
      style={{ aspectRatio: '278 / 280' }}
    >
      {MARK_BARS.map((bar, i) => {
        const color = bar.accent ? '#3FE0A5' : 'var(--color-echo-accent-brand)';
        const style = { width: '9%', height: `${bar.h * 100}%`, background: color };

        if (reducedMotion) {
          return <span key={i} className="rounded-full" style={style} />;
        }

        if (loop) {
          // Loading indicator: must read as motion from frame one (the fallback
          // can unmount within a couple hundred ms on a warm cache), so bars
          // start fully visible and already mid-pulse instead of fading in.
          return (
            <motion.span
              key={i}
              className="rounded-full"
              style={style}
              initial={{ scaleY: 1, opacity: 1 }}
              animate={{ scaleY: [1, 0.5, 1] }}
              transition={{ duration: 0.9, repeat: Infinity, repeatType: 'loop', ease: 'easeInOut', delay: i * 0.09 }}
            />
          );
        }

        return (
          <motion.span
            key={i}
            className="rounded-full"
            style={style}
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 1 }}
            transition={{ ...SPRING_BOUNCY, delay: 0.15 + i * 0.06 }}
          />
        );
      })}
    </div>
  );
}

export default function AppLogo({
  size = 'md',
  withGlow = false,
  circular = false,
  className = '',
}) {
  const preset = SIZES[size] ?? SIZES.md;
  const rounded = circular ? 'rounded-full' : preset.rounded;

  return (
    <div
      className={[
        'flex shrink-0 items-center justify-center overflow-hidden',
        preset.box,
        rounded,
        withGlow && 'echo-glow-md',
        className,
      ].filter(Boolean).join(' ')}
    >
      <img
        src="/icon-192.png"
        alt=""
        width={preset.px}
        height={preset.px}
        className="h-full w-full object-cover"
        draggable={false}
      />
    </div>
  );
}

export function AuthBrandHeader({ subtitle }) {
  const { t } = useTranslation();

  return (
    <div className="mb-8 flex flex-col items-center gap-3">
      <div className="echo-glow-md flex h-32 w-32 shrink-0 items-center justify-center rounded-full">
        <AnimatedLogoMark className="h-20" />
      </div>
      <div className="text-center">
        <h1 className="echo-display echo-grad-text text-3xl font-semibold">
          {t('common.appName')}
        </h1>
        <p className="mt-0.5 text-xs tracking-wide text-muted">{t('auth.tagline')}</p>
        {subtitle ? <p className="mt-3 text-sm font-medium text-foreground/85">{subtitle}</p> : null}
      </div>
    </div>
  );
}
