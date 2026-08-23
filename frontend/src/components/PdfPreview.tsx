import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Button, Tooltip } from '@heroui/react';
import { Download, ExternalLink, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const TARGET_WIDTH = 280; // px — max canvas render width

interface PdfPreviewProps {
  url: string;
  filename?: string;
  onDownload?: () => void;
}

export default function PdfPreview({ url, filename, onDownload }: PdfPreviewProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [pageCount, setPageCount] = useState<number | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;

    setStatus('loading');

    (async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({ url, withCredentials: false });
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        setPageCount(pdf.numPages);

        const page = await pdf.getPage(1);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(TARGET_WIDTH / baseViewport.width, 2);
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvas, viewport }).promise;
        if (!cancelled) setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    return () => { cancelled = true; };
  }, [url]);

  if (status === 'error') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-xl border border-separator/60 bg-background/50 px-3 py-2 text-xs transition-colors hover:bg-default"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
          <FileText size={13} className="text-accent" />
        </div>
        <span className="max-w-40 truncate font-medium">{filename}</span>
        <ExternalLink size={11} className="ml-auto shrink-0 opacity-50" />
      </a>
    );
  }

  return (
    <div className="group relative inline-block overflow-hidden rounded-xl border border-separator/60 bg-white shadow-sm">
      {/* Loading skeleton */}
      {status === 'loading' && (
        <div className="h-48 w-[280px] animate-pulse bg-default/60" />
      )}

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className={`block max-w-[280px] ${status !== 'ready' ? 'hidden' : ''}`}
        style={{ maxHeight: '320px' }}
      />

      {/* Bottom info bar */}
      {status === 'ready' && (
        <div className="flex items-center gap-1.5 border-t border-separator/40 bg-background/90 px-2.5 py-1.5 text-[11px] text-muted backdrop-blur-sm">
          <FileText size={11} className="shrink-0 text-accent" />
          <span className="min-w-0 flex-1 truncate font-medium text-foreground">{filename}</span>
          {pageCount != null && (
            <span className="shrink-0 opacity-60">{pageCount}p</span>
          )}
        </div>
      )}

      {/* Hover actions */}
      <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-black/60 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
          title={t('common.open')}
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink size={12} />
        </a>
        <Tooltip>
          <Button
            isIconOnly
            variant="ghost"
            onPress={() => onDownload?.()}
            className="h-auto w-auto min-w-0 rounded-lg bg-black/60 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
            aria-label={t('common.download')}
          >
            <Download size={12} />
          </Button>
          <Tooltip.Content placement="top">
            <p>{t('common.download')}</p>
          </Tooltip.Content>
        </Tooltip>
      </div>
    </div>
  );
}
