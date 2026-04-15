import { MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function EmptyChat() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-muted">
      <MessageSquare size={64} strokeWidth={1} />
      <div className="text-center">
        <h2 className="text-lg font-semibold text-foreground">{t('common.appName')}</h2>
        <p className="text-sm">{t('chat.empty')}</p>
      </div>
    </div>
  );
}
