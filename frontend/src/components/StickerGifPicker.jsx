import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Button, Tooltip, toast } from '@heroui/react';
import {
  Sticker, Clapperboard, Search, X, Loader2, ImageOff, KeyRound,
  Plus, Trash2, Check,
} from 'lucide-react';
import { giphySearch, GIPHY_ENABLED, GIPHY_ATTRIBUTION } from '@/lib/giphy';
import { storageApi } from '@/lib/endpoints';

/* ─────────────────────────────────────────────────────────
   StickerGifPicker — floating picker for the composer.
   Two tabs:
     · Stickers — the user's own uploaded sticker collection
                  (WhatsApp-style custom stickers, stored in MinIO)
     · GIFs     — Giphy search (needs VITE_GIPHY_API_KEY)
   Selecting an item hands a compact descriptor to onPick, which
   the page turns into a `sticker` message (payload in metadata).
   ───────────────────────────────────────────────────────── */

const KINDS = [
  { key: 'sticker', icon: Sticker },
  { key: 'gif', icon: Clapperboard },
];

const MAX_STICKER_BYTES = 2 * 1024 * 1024; // 2 MB — stickers should stay small

// Read an image's natural dimensions from a File (best-effort, for nicer sizing).
function readImageSize(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve({ width: null, height: null }); };
    img.src = url;
  });
}

/* ── GIF results grid (Giphy) ── */
function GifGrid({ items, loading, error, needsKey, onPick, t }) {
  if (needsKey) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-ink-200">
        <KeyRound size={26} className="opacity-60" />
        <p className="text-[13px] font-medium text-ink-100">{t('sticker.gifKeyTitle')}</p>
        <p className="text-[12px] leading-relaxed">{t('sticker.gifKeyHint')}</p>
        <a
          href="https://developers.giphy.com"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 text-[12px] font-semibold text-accent underline underline-offset-2 hover:opacity-80"
        >
          developers.giphy.com
        </a>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-ink-200">
        <ImageOff size={26} className="opacity-60" />
        <p className="text-[13px]">{t('sticker.error')}</p>
      </div>
    );
  }
  if (loading && items.length === 0) {
    return <div className="flex h-full items-center justify-center text-ink-200"><Loader2 size={22} className="animate-spin" /></div>;
  }
  if (!loading && items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-ink-200">
        <Search size={22} className="opacity-50" />
        <p className="text-[13px]">{t('sticker.noResults')}</p>
      </div>
    );
  }
  return (
    <div className="columns-2 gap-2 [column-fill:_balance]">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onPick(item)}
          title={item.alt}
          className="echo-press mb-2 block w-full overflow-hidden rounded-lg border border-transparent bg-ink-800 transition-colors hover:border-accent/60"
        >
          <img
            src={item.preview}
            alt={item.alt}
            loading="lazy"
            className="w-full object-contain"
            style={item.width && item.height ? { aspectRatio: `${item.width} / ${item.height}` } : undefined}
          />
        </button>
      ))}
    </div>
  );
}

/* ── Custom sticker collection ── */
function StickerGrid({ stickers, loading, uploading, managing, onPick, onAdd, onDelete, t }) {
  if (loading) {
    return <div className="flex h-full items-center justify-center text-ink-200"><Loader2 size={22} className="animate-spin" /></div>;
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      {/* Add tile */}
      <button
        type="button"
        onClick={onAdd}
        disabled={uploading}
        className="echo-press flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-ink-400/60 text-ink-200 transition-colors hover:border-accent/70 hover:text-accent disabled:opacity-60"
      >
        {uploading ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
        <span className="text-[11px] font-medium">{t('sticker.add')}</span>
      </button>

      {stickers.length === 0 && !uploading && (
        <div className="col-span-2 flex aspect-square flex-col items-center justify-center gap-1 px-2 text-center text-ink-200">
          <Sticker size={22} className="opacity-50" />
          <p className="text-[12px] leading-snug">{t('sticker.empty')}</p>
        </div>
      )}

      {stickers.map((s) => (
        <div key={s.id} className="echo-checker relative aspect-square overflow-hidden rounded-lg">
          <button
            type="button"
            onClick={() => (managing ? onDelete(s) : onPick(s))}
            title={managing ? t('sticker.delete') : t('sticker.send')}
            className="echo-press flex h-full w-full items-center justify-center p-1.5 transition-transform hover:scale-105"
          >
            <img src={s.url} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
          </button>
          {managing && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45">
              <Trash2 size={20} className="text-white" />
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function StickerGifPicker({ onPick, disabled, open, onOpenChange }) {
  const { t } = useTranslation();
  const setOpen = useCallback((next) => {
    onOpenChange(typeof next === 'function' ? next(open) : next);
  }, [open, onOpenChange]);
  const [kind, setKind] = useState('sticker');
  const [query, setQuery] = useState('');

  // GIF state
  const [gifs, setGifs] = useState([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifError, setGifError] = useState(false);

  // Custom sticker state
  const [stickers, setStickers] = useState([]);
  const [stickersLoaded, setStickersLoaded] = useState(false);
  const [stickersLoading, setStickersLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [managing, setManaging] = useState(false);

  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const abortRef = useRef(null);
  const fileRef = useRef(null);

  const needsKey = kind === 'gif' && !GIPHY_ENABLED;

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  // Load the user's stickers the first time the picker opens.
  const loadStickers = useCallback(async () => {
    setStickersLoading(true);
    try {
      const { data } = await storageApi.listStickers();
      setStickers(data);
    } catch {
      setStickers([]);
    } finally {
      setStickersLoading(false);
      setStickersLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (open && kind === 'sticker' && !stickersLoaded) loadStickers();
  }, [open, kind, stickersLoaded, loadStickers]);

  // GIF search (debounced) — only when the GIF tab is active with a key.
  useEffect(() => {
    if (!open || kind !== 'gif' || needsKey) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setGifLoading(true);
    setGifError(false);

    const run = async () => {
      try {
        const data = await giphySearch('gif', query, { limit: 24, signal: controller.signal });
        if (!controller.signal.aborted) setGifs(data);
      } catch (err) {
        if (err?.name !== 'AbortError') { setGifError(true); setGifs([]); }
      } finally {
        if (!controller.signal.aborted) setGifLoading(false);
      }
    };
    const timer = setTimeout(run, query.trim() ? 350 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, kind, query, needsKey]);

  const handlePick = useCallback((item) => { onPick(item); setOpen(false); }, [onPick]);

  const switchKind = useCallback((k) => {
    setKind(k);
    setManaging(false);
    if (k === 'gif') searchRef.current?.focus();
  }, []);

  // Upload a new custom sticker.
  const handleFilePicked = useCallback(async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.danger(t('sticker.notImage')); return; }
    if (file.size > MAX_STICKER_BYTES) { toast.danger(t('sticker.tooBig')); return; }
    setUploading(true);
    try {
      const { width, height } = await readImageSize(file);
      const { data: obj } = await storageApi.upload(file, 'sticker', {
        ...(width ? { image_width: width } : {}),
        ...(height ? { image_height: height } : {}),
      });
      // Prepend so the newest sticker shows first, matching the API ordering.
      const url = (await storageApi.getUrl(obj.id)).data.url;
      setStickers((prev) => [{ id: obj.id, url, width, height }, ...prev]);
    } catch (err) {
      console.error('Sticker upload failed:', err);
      toast.danger(t('sticker.uploadError'));
    } finally {
      setUploading(false);
    }
  }, [t]);

  const handleDelete = useCallback(async (s) => {
    setStickers((prev) => prev.filter((x) => x.id !== s.id));
    try {
      await storageApi.deleteSticker(s.id);
    } catch (err) {
      console.error('Sticker delete failed:', err);
      loadStickers(); // resync on failure
    }
  }, [loadStickers]);

  return (
    <div className="relative" ref={rootRef}>
      <Tooltip content={t('sticker.title')} placement="top">
        <Button
          isIconOnly
          variant="ghost"
          isDisabled={disabled}
          onPress={() => setOpen((p) => !p)}
          aria-label={t('sticker.title')}
          aria-expanded={open}
          className="flex h-9 w-9 min-w-0 shrink-0 items-center justify-center rounded-md text-ink-100 transition-colors hover:bg-ink-750 hover:text-foreground"
        >
          <Sticker size={18} />
        </Button>
      </Tooltip>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="absolute bottom-11 right-0 z-40 flex h-[420px] w-[min(360px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-ink-400/40 bg-ink-850 shadow-2xl"
          >
            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-ink-400/30 p-1.5">
              {KINDS.map(({ key, icon: Icon }) => (
                <Button
                  key={key}
                  variant="ghost"
                  onPress={() => switchKind(key)}
                  className={[
                    'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-[13px] font-semibold transition-colors',
                    kind === key ? 'bg-accent/15 text-accent' : 'text-ink-100 hover:bg-ink-750 hover:text-foreground',
                  ].join(' ')}
                >
                  <Icon size={15} />
                  {t(key === 'gif' ? 'sticker.gifs' : 'sticker.stickers')}
                </Button>
              ))}
            </div>

            {/* Toolbar: search (GIF) or manage toggle (stickers) */}
            {kind === 'gif' && !needsKey && (
              <div className="p-1.5">
                <div className="flex items-center gap-2 rounded-lg bg-ink-750 px-2.5">
                  <Search size={15} className="shrink-0 text-ink-200" />
                  <input
                    ref={searchRef}
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('sticker.searchGifs')}
                    className="min-w-0 flex-1 bg-transparent py-2 text-[14px] text-foreground outline-none placeholder:text-ink-200"
                  />
                  {query && (
                    <button type="button" onClick={() => { setQuery(''); searchRef.current?.focus(); }}
                      className="shrink-0 rounded p-0.5 text-ink-200 transition-colors hover:text-foreground" aria-label={t('common.clear')}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            )}
            {kind === 'sticker' && stickers.length > 0 && (
              <div className="flex items-center justify-between px-2.5 py-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wide text-ink-300">
                  {t('sticker.myStickers')}
                </span>
                <button
                  type="button"
                  onClick={() => setManaging((m) => !m)}
                  className={[
                    'flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-semibold transition-colors',
                    managing ? 'bg-accent/15 text-accent' : 'text-ink-200 hover:bg-ink-750 hover:text-foreground',
                  ].join(' ')}
                >
                  {managing ? <><Check size={13} />{t('sticker.done')}</> : <><Trash2 size={13} />{t('sticker.manage')}</>}
                </button>
              </div>
            )}

            {/* Body */}
            <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5">
              {kind === 'gif' ? (
                <GifGrid items={gifs} loading={gifLoading} error={gifError} needsKey={needsKey} onPick={handlePick} t={t} />
              ) : (
                <StickerGrid
                  stickers={stickers}
                  loading={stickersLoading && !stickersLoaded}
                  uploading={uploading}
                  managing={managing}
                  onPick={(s) => handlePick({ source: 'custom', kind: 'sticker', object_id: s.id, url: s.url, width: s.width, height: s.height })}
                  onAdd={() => fileRef.current?.click()}
                  onDelete={handleDelete}
                  t={t}
                />
              )}
            </div>

            {/* Attribution — Giphy terms require crediting the source */}
            {kind === 'gif' && !needsKey && (
              <div className="flex items-center justify-end border-t border-ink-400/30 px-2.5 py-1">
                <span className="text-[10px] font-medium uppercase tracking-wide text-ink-300">{GIPHY_ATTRIBUTION}</span>
              </div>
            )}

            {/* Hidden file input for sticker uploads */}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFilePicked(f); e.target.value = ''; }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
