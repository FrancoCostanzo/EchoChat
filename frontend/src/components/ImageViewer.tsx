import { useState, useRef, useEffect, useCallback, type WheelEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Button, Tooltip } from '@heroui/react';
import { X, ZoomIn, ZoomOut, RotateCcw, Download, Maximize2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EASE_OUT, SPRING_SOFT } from '@/lib/motion';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.25;

interface ImageViewerProps {
  src: string;
  filename?: string;
  onClose: () => void;
  layoutId?: string;
}

export default function ImageViewer({ src, filename, onClose, layoutId }: ImageViewerProps) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [sharedLayout, setSharedLayout] = useState(!!layoutId);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!layoutId || reducedMotion) return undefined;
    const timer = setTimeout(() => setSharedLayout(false), 450);
    return () => clearTimeout(timer);
  }, [layoutId, reducedMotion]);

  const clampZoom = (v: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v));

  const handleZoomIn = useCallback(() => {
    setZoom((z) => clampZoom(z + ZOOM_STEP));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => {
      const next = clampZoom(z - ZOOM_STEP);
      if (next <= 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') handleZoomIn();
      if (e.key === '-') handleZoomOut();
      if (e.key === '0') handleReset();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, handleZoomIn, handleZoomOut, handleReset]);

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
    setZoom((z) => {
      const next = clampZoom(z + delta);
      if (next <= 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  };

  const handleMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setDragging(true);
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };

  const handleMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!dragging || !dragStart.current) return;
    setOffset({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };

  const handleMouseUp = () => {
    setDragging(false);
    dragStart.current = null;
  };

  const handleDownload = async () => {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename || 'image';
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(src, '_blank');
    }
  };

  const handleOpenNew = () => {
    window.open(src, '_blank', 'noopener,noreferrer');
  };

  const backdropTransition = reducedMotion ? { duration: 0.01 } : { duration: 0.22, ease: EASE_OUT };
  const panelTransition = reducedMotion ? { duration: 0.01 } : SPRING_SOFT;

  return createPortal(
    <motion.div
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
              onPress={handleOpenNew}
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

      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: zoom > 1 ? (dragging ? 'grabbing' : 'grab') : 'default' }}
      >
        <motion.img
          ref={imgRef}
          src={src}
          alt={filename}
          draggable={false}
          layoutId={sharedLayout ? layoutId : undefined}
          initial={layoutId && !reducedMotion ? false : { opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
          transition={sharedLayout ? { layout: { duration: 0.38, ease: EASE_OUT } } : panelTransition}
          style={{
            transform: sharedLayout
              ? undefined
              : `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: dragging ? 'none' : 'transform 0.15s ease',
            maxWidth: '100%',
            maxHeight: '100%',
            userSelect: 'none',
          }}
        />
      </div>

      <motion.div
        className="flex shrink-0 items-center justify-center gap-2 px-4 py-3"
        initial={reducedMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reducedMotion ? undefined : { opacity: 0, y: 8 }}
        transition={{ ...panelTransition, delay: reducedMotion ? 0 : 0.06 }}
      >
        <Tooltip>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/10"
            onPress={handleZoomOut}
            isDisabled={zoom <= MIN_ZOOM}
            aria-label={t('imageViewer.zoomOut')}
          >
            <ZoomOut size={18} />
          </Button>
          <Tooltip.Content placement="top">
            <p>{t('imageViewer.zoomOut')}</p>
          </Tooltip.Content>
        </Tooltip>

        <Tooltip>
          <Button
            variant="ghost"
            onPress={handleReset}
            className="h-auto min-w-13 rounded-md px-2 py-1 text-center text-xs text-white/80 hover:bg-white/10"
            aria-label={t('imageViewer.reset')}
          >
            {Math.round(zoom * 100)}%
          </Button>
          <Tooltip.Content placement="top">
            <p>{t('imageViewer.reset')}</p>
          </Tooltip.Content>
        </Tooltip>

        <Tooltip>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/10"
            onPress={handleZoomIn}
            isDisabled={zoom >= MAX_ZOOM}
            aria-label={t('imageViewer.zoomIn')}
          >
            <ZoomIn size={18} />
          </Button>
          <Tooltip.Content placement="top">
            <p>{t('imageViewer.zoomIn')}</p>
          </Tooltip.Content>
        </Tooltip>

        <Tooltip>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            className="ml-2 text-white hover:bg-white/10"
            onPress={handleReset}
            aria-label={t('imageViewer.reset')}
          >
            <RotateCcw size={16} />
          </Button>
          <Tooltip.Content placement="top">
            <p>{t('imageViewer.reset')}</p>
          </Tooltip.Content>
        </Tooltip>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
