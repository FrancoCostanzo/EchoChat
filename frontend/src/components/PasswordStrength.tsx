import { Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** Reglas que tiene que cumplir una contraseña nueva (registro y "elegir contraseña"). */
export const PASSWORD_RULES: { key: string; test: (p: string) => boolean }[] = [
  { key: 'minLength', test: (p) => p.length >= 8 },
  { key: 'uppercase', test: (p) => /[A-Z]/.test(p) },
  { key: 'lowercase', test: (p) => /[a-z]/.test(p) },
  { key: 'number', test: (p) => /\d/.test(p) },
];

export default function PasswordStrength({ password }: { password: string }) {
  const { t } = useTranslation();
  if (!password) return null;
  const passed = PASSWORD_RULES.filter((r) => r.test(password)).length;
  const colors = ['bg-danger', 'bg-warning', 'bg-warning', 'bg-success'];
  const labels = [
    t('auth.passwordStrength.veryWeak'),
    t('auth.passwordStrength.weak'),
    t('auth.passwordStrength.fair'),
    t('auth.passwordStrength.strong'),
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">
        {PASSWORD_RULES.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i < passed ? colors[passed - 1] : 'bg-default'}`}
          />
        ))}
      </div>
      <p className={`text-xs ${passed >= 4 ? 'text-success' : passed >= 2 ? 'text-warning' : 'text-danger'}`}>
        {labels[passed - 1] ?? t('auth.passwordStrength.veryWeak')}
      </p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(password);
          return (
            <p key={rule.key} className={`flex items-center gap-1 text-xs ${ok ? 'text-success' : 'text-muted'}`}>
              {ok ? <Check size={11} /> : <X size={11} />}
              {t(`auth.passwordRules.${rule.key}`)}
            </p>
          );
        })}
      </div>
    </div>
  );
}
