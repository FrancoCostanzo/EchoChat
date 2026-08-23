import { useState, useEffect } from 'react';
import { Modal, Button, Label, ListBox, Select, TextArea } from '@heroui/react';
import { Code2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { messagesApi } from '@/lib/endpoints';
import { CODE_LANGUAGES } from '@/lib/codeLanguages';

interface CreateCodeModalProps {
  conversationId: string;
  isOpen: boolean;
  onClose: () => void;
  initialBody?: string;
  initialLanguage?: string;
}

export default function CreateCodeModal({
  conversationId,
  isOpen,
  onClose,
  initialBody = '',
  initialLanguage = 'plaintext',
}: CreateCodeModalProps) {
  const { t } = useTranslation();
  const [body, setBody] = useState(initialBody);
  const [language, setLanguage] = useState(initialLanguage);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setBody(initialBody);
      setLanguage(initialLanguage);
      setError(null);
    }
  }, [isOpen, initialBody, initialLanguage]);

  const reset = () => {
    setBody('');
    setLanguage('plaintext');
    setBusy(false);
    setError(null);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
      reset();
    }
  };

  const canSubmit = body.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      await messagesApi.send({
        conversation_id: conversationId,
        type: 'code',
        body: body.trimEnd(),
        metadata: { language },
      });
      onClose();
      reset();
    } catch (err) {
      setError((err instanceof Error && err.message) || t('code.sendError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="lg">
          <Modal.Dialog className="max-w-xl">
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2">
                <Code2 size={16} className="text-accent" />
                {t('code.sendTitle')}
              </Modal.Heading>
              <Modal.CloseTrigger />
            </Modal.Header>

            <Modal.Body className="flex flex-col gap-3">
              <Select
                className="w-full"
                placeholder={t('code.language')}
                value={language}
                onChange={(value) => setLanguage(String(value))}
              >
                <Label>{t('code.language')}</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {CODE_LANGUAGES.map(({ id, labelKey }) => (
                      <ListBox.Item key={id} id={id} textValue={t(labelKey)}>
                        {t(labelKey)}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="code-body">{t('code.snippet')}</Label>
                <TextArea
                  id="code-body"
                  fullWidth
                  rows={12}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={t('code.placeholder')}
                  spellCheck={false}
                  variant="secondary"
                  className="font-mono text-[13px] leading-relaxed"
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-sm text-echo-dnd" role="alert">
                  {error}
                </p>
              )}
            </Modal.Body>

            <Modal.Footer>
              <Button variant="ghost" onPress={() => handleOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button isDisabled={!canSubmit} isPending={busy} onPress={handleSubmit}>
                {t('code.send')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
