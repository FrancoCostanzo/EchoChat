import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertDialog, Button } from '@heroui/react';
import { useTranslation } from 'react-i18next';

/**
 * Reusable imperative confirmation dialog.
 *
 *   const confirm = useConfirm();
 *   if (await confirm({ title, message, status: 'danger' })) { ... }
 *
 * Resolves `true` when the user confirms, `false` on cancel / backdrop / Esc.
 * The dialog itself stays dumb — callers own the side effect (and any toast).
 */
const ConfirmContext = createContext(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within <ConfirmProvider>');
  return ctx;
}

const DEFAULTS = { status: 'danger' };

export function ConfirmProvider({ children }) {
  const { t } = useTranslation();
  const [options, setOptions] = useState(DEFAULTS);
  const [isOpen, setIsOpen] = useState(false);
  const resolverRef = useRef(null);

  const settle = useCallback((result) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setIsOpen(false);
    resolve?.(result);
  }, []);

  const confirm = useCallback((opts = {}) => {
    setOptions({ ...DEFAULTS, ...opts });
    setIsOpen(true);
    return new Promise((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const handleOpenChange = useCallback(
    (open) => {
      if (!open) settle(false);
    },
    [settle],
  );

  const {
    title,
    message,
    status,
    confirmLabel,
    cancelLabel,
    confirmVariant,
  } = options;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={handleOpenChange}>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-[420px]">
            <AlertDialog.CloseTrigger />
            <AlertDialog.Header>
              <AlertDialog.Icon status={status} />
              <AlertDialog.Heading>
                {title || t('confirm.defaultTitle')}
              </AlertDialog.Heading>
            </AlertDialog.Header>
            {message && (
              <AlertDialog.Body>
                <p className="text-pretty">{message}</p>
              </AlertDialog.Body>
            )}
            <AlertDialog.Footer>
              <Button variant="tertiary" onPress={() => settle(false)}>
                {cancelLabel || t('common.cancel')}
              </Button>
              <Button
                variant={confirmVariant || (status === 'danger' ? 'danger' : 'primary')}
                onPress={() => settle(true)}
                autoFocus
              >
                {confirmLabel || t('confirm.defaultConfirm')}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </ConfirmContext.Provider>
  );
}
