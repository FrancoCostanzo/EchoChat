import { useTranslation } from 'react-i18next';

const SIZES = {
  xs: { box: 'h-5 w-5', px: 20, rounded: 'rounded-md' },
  sm: { box: 'h-9 w-9', px: 36, rounded: 'rounded-xl' },
  md: { box: 'h-14 w-14', px: 56, rounded: 'rounded-2xl' },
  lg: { box: 'h-28 w-28', px: 112, rounded: 'rounded-3xl' },
};

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
      <AppLogo size="md" circular withGlow />
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
