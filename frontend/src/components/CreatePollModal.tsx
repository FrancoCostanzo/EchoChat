import { useState } from 'react';
import { Modal, Button, Input, Switch } from '@heroui/react';
import { Plus, Trash2, BarChart3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { pollsApi } from '@/lib/endpoints';

const MAX_OPTIONS = 10;

interface CreatePollModalProps {
  conversationId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function CreatePollModal({ conversationId, isOpen, onClose }: CreatePollModalProps) {
  const { t } = useTranslation();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isMultiple, setIsMultiple] = useState(false);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setQuestion('');
    setOptions(['', '']);
    setIsAnonymous(false);
    setIsMultiple(false);
    setBusy(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
      reset();
    }
  };

  const setOption = (i: number, value: string) =>
    setOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)));
  const addOption = () =>
    setOptions((prev) => (prev.length >= MAX_OPTIONS ? prev : [...prev, '']));
  const removeOption = (i: number) =>
    setOptions((prev) => (prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i)));

  const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
  const canSubmit = question.trim().length > 0 && cleanOptions.length >= 2;

  const handleSubmit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      await pollsApi.create({
        conversation_id: conversationId,
        question: question.trim(),
        options: cleanOptions,
        is_anonymous: isAnonymous,
        is_multiple: isMultiple,
      });
      onClose();
      reset();
    } catch {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="md">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2">
                <BarChart3 size={16} /> {t('poll.create')}
              </Modal.Heading>
              <Modal.CloseTrigger />
            </Modal.Header>

            <Modal.Body className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-200">{t('poll.question')}</label>
                <Input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={t('poll.questionPlaceholder')}
                  maxLength={500}
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-ink-200">{t('poll.options')}</label>
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      className="flex-1"
                      value={opt}
                      onChange={(e) => setOption(i, e.target.value)}
                      placeholder={`${t('poll.option')} ${i + 1}`}
                      maxLength={300}
                    />
                    {options.length > 2 && (
                      <Button
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        aria-label={t('common.delete')}
                        onPress={() => removeOption(i)}
                      >
                        <Trash2 size={15} />
                      </Button>
                    )}
                  </div>
                ))}
                {options.length < MAX_OPTIONS && (
                  <Button variant="ghost" size="sm" className="self-start gap-1 text-accent" onPress={addOption}>
                    <Plus size={14} /> {t('poll.addOption')}
                  </Button>
                )}
              </div>

              <Switch isSelected={isMultiple} onChange={setIsMultiple}>
                <Switch.Control><Switch.Thumb /></Switch.Control>
                <Switch.Content>{t('poll.allowMultiple')}</Switch.Content>
              </Switch>
              <Switch isSelected={isAnonymous} onChange={setIsAnonymous}>
                <Switch.Control><Switch.Thumb /></Switch.Control>
                <Switch.Content>{t('poll.makeAnonymous')}</Switch.Content>
              </Switch>
            </Modal.Body>

            <Modal.Footer>
              <Button className="w-full" isDisabled={!canSubmit} isPending={busy} onPress={handleSubmit}>
                {t('poll.create')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
