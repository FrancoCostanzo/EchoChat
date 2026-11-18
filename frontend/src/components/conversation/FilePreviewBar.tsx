import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button, Input } from '@heroui/react';
import { X, Loader, Image, Film, FileText, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SPRING_OUT } from '@/components/conversation/shared';

/* ─────────────────────────── File Preview Bar ─────────────────────────── */
export default function FilePreviewBar({
  file,
  onSend,
  onCancel,
}: {
  file: File;
  onSend: (file: File, caption: string) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [caption, setCaption] = useState('');
  const [sending, setSending] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const isImage = file?.type.startsWith('image/');
  const isVideo = file?.type.startsWith('video/');

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => { URL.revokeObjectURL(url); setObjectUrl(null); };
  }, [file]);

  const handleSend = async () => {
    setSending(true);
    try { await onSend(file, caption.trim()); }
    finally { setSending(false); }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.22, ease: SPRING_OUT }}
      className="mx-3 overflow-hidden rounded-t-lg border-b border-ink-900 bg-ink-800"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-black/20 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {isImage
            ? <Image size={14} className="shrink-0 text-accent" />
            : isVideo
              ? <Film size={14} className="shrink-0 text-accent" />
              : <FileText size={14} className="shrink-0 text-accent" />}
          <span className="truncate text-[13px] font-semibold">{file.name}</span>
          <span className="shrink-0 text-[11px] text-ink-200">{formatSize(file.size)}</span>
        </div>
        <Button
          isIconOnly
          variant="ghost"
          onPress={onCancel}
          isDisabled={sending}
          className="ml-2 h-auto w-auto min-w-0 shrink-0 rounded-md p-1 text-ink-100 transition-colors hover:bg-ink-750 hover:text-foreground"
        >
          <X size={15} />
        </Button>
      </div>

      {/* Preview area */}
      <div className="flex max-h-60 items-center justify-center overflow-hidden bg-ink-900/50 px-4 py-3">
        {isImage && (
            <img src={objectUrl ?? undefined} alt={file.name} className="max-h-52 max-w-full rounded-lg object-contain shadow-md" />
          )}
          {isVideo && (
            <video src={objectUrl ?? undefined} controls className="max-h-52 max-w-full rounded-lg shadow-md" />
          )}
          {!isImage && !isVideo && (
            <div className="flex items-center gap-4 py-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-accent/15">
                <FileText size={28} className="text-accent" />
              </div>
              <div className="min-w-0">
                <p className="max-w-xs truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-ink-200">{formatSize(file.size)}</p>
              </div>
            </div>
          )}
      </div>

      {/* Caption + send */}
      <div className="flex items-end gap-2 px-3 py-2.5">
          <Input
            autoFocus
            placeholder={t('chat.captionPlaceholder')}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
              if (e.key === 'Escape') onCancel();
            }}
            disabled={sending}
            className="flex-1 border-ink-400/40 bg-ink-750"
          />
          <Button
            isIconOnly
            isDisabled={sending}
            className="shrink-0 rounded-md bg-accent text-accent-foreground transition-[filter] hover:brightness-110"
            onPress={handleSend}
          >
            {sending ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
          </Button>
        </div>
    </motion.div>
  );
}
