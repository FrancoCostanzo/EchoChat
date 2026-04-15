import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@heroui/react';
import { X, ZoomIn, ZoomOut, RotateCcw, Download, Maximize2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.25;

export default function ImageViewer({ src, filename, onClose }) {
  const { t } = useTranslation();
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef(null);
  const imgRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') handleZoomIn();
      if (e.key === '-') handleZoomOut();
      if (e.key === '0') handleReset();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [zoom]);

  const clampZoom = (v) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v));

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

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
    setZoom((z) => {
      const next = clampZoom(z + delta);
      if (next <= 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  };

  const handleMouseDown = (e) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setDragging(true);
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };

  const handleMouseMove = (e) => {
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

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/90"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between px-4 py-3">
        <span className="max-w-xs truncate text-sm text-white/70">{filename}</span>
        <div className="flex items-center gap-1">
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/10"
            onPress={handleDownload}
            title={t('imageViewer.download')}
          >
            <Download size={16} />
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/10"
            onPress={handleOpenNew}
            title={t('imageViewer.openNewTab')}
          >
            <Maximize2 size={16} />
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/10"
            onPress={onClose}
            title={t('imageViewer.close')}
          >
            <X size={18} />
          </Button>
        </div>
      </div>

      {/* Image area */}
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: zoom > 1 ? (dragging ? 'grabbing' : 'grab') : 'default' }}
      >
        <img
          ref={imgRef}
          src={src}
          alt={filename}
          draggable={false}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: dragging ? 'none' : 'transform 0.15s ease',
            maxWidth: '100%',
            maxHeight: '100%',
            userSelect: 'none',
          }}
        />
      </div>

      {/* Bottom bar */}
      <div className="flex shrink-0 items-center justify-center gap-2 px-4 py-3">
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          className="text-white hover:bg-white/10"
          onPress={handleZoomOut}
          isDisabled={zoom <= MIN_ZOOM}
          title={t('imageViewer.zoomOut')}
        >
          <ZoomOut size={18} />
        </Button>

        <button
          onClick={handleReset}
          className="min-w-13 rounded-md px-2 py-1 text-center text-xs text-white/80 hover:bg-white/10"
          title={t('imageViewer.reset')}
        >
          {Math.round(zoom * 100)}%
        </button>

        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          className="text-white hover:bg-white/10"
          onPress={handleZoomIn}
          isDisabled={zoom >= MAX_ZOOM}
          title={t('imageViewer.zoomIn')}
        >
          <ZoomIn size={18} />
        </Button>

        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          className="ml-2 text-white hover:bg-white/10"
          onPress={handleReset}
          title="Restablecer zoom"
        >
          <RotateCcw size={16} />
        </Button>
      </div>
    </div>,
    document.body
  );
}
