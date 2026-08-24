import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Button, Tooltip } from '@heroui/react';
import { X, Download, Maximize2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EASE_OUT, SPRING_SOFT } from '@/lib/motion';
import { downloadFile } from '@/lib/download';

interface VideoViewerProps {
  src: string;
  filename?: string;
  onClose: () => void;
  layoutId?: string;
}

export default function VideoViewer({ src, filename, onClose, layoutId }: VideoViewerProps) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [sharedLayout, setSharedLayout] = useState(!!layoutId);

  useEffect(() => {
    if (!layoutId || reducedMotion) return undefined;
    const timer = setTimeout(() => setSharedLayout(false), 450);
    return () => clearTimeout(timer);
  }, [layoutId, reducedMotion]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const root = document.getElementById('echo-video-viewer-root');
      if (root?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [onClose]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return undefined;
    const play = () => { v.play().catch(() => {}); };
    play();
    return () => { v.pause(); };
  }, [src]);

  const handleDownload = () => downloadFile(src, filename, 'video');

  const backdropTransition = reducedMotion ? { duration: 0.01 } : { duration: 0.22, ease: EASE_OUT };
  const panelTransition = reducedMotion ? { duration: 0.01 } : SPRING_SOFT;

  return createPortal(
    <motion.div
      id="echo-video-viewer-root"
      role="dialog"
      aria-modal="true"
      aria-label={filename || t('imageViewer.close')}
      className="fixed inset-0 z-50 flex flex-col bg-black/92 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={backdropTransition}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        className="flex shrink-0 items-center justify-between px-4 py-3"
        initial={reducedMotion ? false : { opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
        transition={{ ...panelTransition, delay: reducedMotion ? 0 : 0.04 }}
      >
        <span className="max-w-xs truncate text-sm text-white/70">{filename}</span>
        <div className="flex items-center gap-1">
          <Tooltip>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              className="text-white hover:bg-white/10"
              onPress={handleDownload}
              aria-label={t('imageViewer.download')}
            >
              <Download size={16} />
            </Button>
            <Tooltip.Content placement="bottom">
              <p>{t('imageViewer.download')}</p>
            </Tooltip.Content>
          </Tooltip>
          <Tooltip>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              className="text-white hover:bg-white/10"
              onPress={() => window.open(src, '_blank', 'noopener,noreferrer')}
              aria-label={t('imageViewer.openNewTab')}
            >
              <Maximize2 size={16} />
            </Button>
            <Tooltip.Content placement="bottom">
              <p>{t('imageViewer.openNewTab')}</p>
            </Tooltip.Content>
          </Tooltip>
          <Tooltip>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              className="text-white hover:bg-white/10"
              onPress={onClose}
              aria-label={t('imageViewer.close')}
            >
              <X size={18} />
            </Button>
            <Tooltip.Content placement="bottom">
              <p>{t('imageViewer.close')}</p>
            </Tooltip.Content>
          </Tooltip>
        </div>
      </motion.div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 pb-4">
        <motion.video
          ref={videoRef}
          src={src}
          controls
          playsInline
          layoutId={sharedLayout ? layoutId : undefined}
          initial={layoutId && !reducedMotion ? false : { opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
          transition={sharedLayout ? { layout: { duration: 0.38, ease: EASE_OUT } } : panelTransition}
          className="max-h-full max-w-full rounded-lg bg-black shadow-2xl"
        />
      </div>
    </motion.div>,
    document.body,
  );
}
