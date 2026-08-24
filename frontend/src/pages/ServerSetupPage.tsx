import { useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, TextField, Label, InputGroup, FieldError, Button, Spinner } from '@heroui/react';
import { AlertCircle, Server } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AuthLayout from '@/layouts/AuthLayout';
import { EASE_OUT } from '@/lib/motion';
import type { ServerProbeError } from '@/types/electron';

/**
 * Primera pantalla de la app de escritorio: el instalador es el mismo para
 * todos, así que cada organización apunta al suyo. En la web esta pantalla no
 * se monta nunca (ver lib/runtimeConfig.ts).
 */

const ERROR_KEYS: Record<ServerProbeError, string> = {
  'invalid-url': 'server.errors.invalidUrl',
  unreachable: 'server.errors.unreachable',
  'not-echochat': 'server.errors.notEchochat',
  degraded: 'server.errors.degraded',
};

export default function ServerSetupPage() {
  const { t } = useTranslation();

  const [url, setUrl] = useState(
    () => window.electronAPI?.getServerUrl() || (import.meta.env.DEV ? 'http://localhost:3000' : ''),
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!url.trim() || loading) return;

    setError('');
    setLoading(true);
    try {
      const result = await window.electronAPI!.setServerUrl(url);
      // Cuando la URL sirve, el main recrea la ventana y este renderer muere
      // antes de llegar acá: sólo seguimos vivos si falló.
      if (!result.ok) setError(t(ERROR_KEYS[result.error ?? 'unreachable']));
    } catch {
      setError(t('server.errors.unreachable'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout subtitle={t('server.title')}>
      <Card className="echo-glass-strong overflow-hidden">
        <Card.Content className="p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
            <div className="flex flex-col items-center gap-2 pb-1 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft">
                <Server className="h-6 w-6 text-accent" />
              </div>
              <p className="text-sm text-muted">{t('server.prompt')}</p>
            </div>

            <AnimatePresence initial={false}>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: EASE_OUT }}
                  className="flex items-center gap-2 rounded-lg border border-danger-soft-hover bg-danger-soft px-3 py-2.5 text-sm text-danger"
                >
                  <AlertCircle size={16} className="shrink-0" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <TextField fullWidth>
              <Label>{t('server.urlLabel')}</Label>
              <InputGroup fullWidth variant="secondary">
                <InputGroup.Input
                  placeholder={t('server.urlPlaceholder')}
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (error) setError('');
                  }}
                  autoFocus
                  autoComplete="url"
                  inputMode="url"
                  spellCheck={false}
                />
              </InputGroup>
              <FieldError />
            </TextField>

            <Button type="submit" fullWidth isDisabled={!url.trim() || loading}>
              {loading ? <Spinner size="sm" /> : t('server.connect')}
            </Button>

            <p className="text-center text-xs text-muted">{t('server.hint')}</p>
          </form>
        </Card.Content>
      </Card>
    </AuthLayout>
  );
}
