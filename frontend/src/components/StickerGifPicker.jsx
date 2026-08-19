import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Button, Label, ListBox, Select, Tooltip, toast } from '@heroui/react';
import {
  Sticker, Clapperboard, Search, X, Loader2, ImageOff, KeyRound,
  Plus, Trash2, Check, Star, Pencil, FolderPlus, ChevronLeft,
} from 'lucide-react';
import { giphySearch, GIPHY_ENABLED, GIPHY_ATTRIBUTION } from '@/lib/giphy';
import { stickerApi } from '@/lib/endpoints';

/* ─────────────────────────────────────────────────────────
   StickerGifPicker — floating picker for the composer.
   Two tabs:
     · Stickers — the user's personal collection with packs,
                  keywords/search, favorites and recents.
     · GIFs     — Giphy search (needs VITE_GIPHY_API_KEY)
   Selecting an item hands a compact descriptor to onPick, which
   the page turns into a `sticker` message (payload in metadata).
   ───────────────────────────────────────────────────────── */

const KINDS = [
  { key: 'sticker', icon: Sticker },
  { key: 'gif', icon: Clapperboard },
];

const MAX_STICKER_BYTES = 5 * 1024 * 1024; // 5 MB — animated stickers need headroom
const STICKER_MIMES = ['image/webp', 'image/png', 'image/gif', 'image/jpeg'];

const EMPTY_COLLECTION = { packs: [], stickers: [], recents: [] };
const NO_PACK = 'none';

function isPortaledOverlay(target) {
  return target instanceof Element && Boolean(
    target.closest('[data-react-aria-top-layer], [role="listbox"], [data-slot="popover"]'),
  );
}

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

/* ── A single sticker tile ── */
function StickerTile({ sticker, managing, onPick, onEdit, t }) {
  return (
    <div className="echo-checker relative aspect-square overflow-hidden rounded-lg">
      <button
        type="button"
        onClick={() => (managing ? onEdit(sticker) : onPick(sticker))}
        title={managing ? t('sticker.editSticker') : t('sticker.send')}
        className="echo-press flex h-full w-full items-center justify-center p-1.5 transition-transform hover:scale-105"
      >
        <img src={sticker.url} alt={sticker.name || ''} loading="lazy" className="max-h-full max-w-full object-contain" />
      </button>
      {sticker.is_favorite && !managing && (
        <span className="pointer-events-none absolute right-1 top-1 text-amber-400 drop-shadow">
          <Star size={13} fill="currentColor" />
        </span>
      )}
      {managing && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45">
          <Pencil size={18} className="text-white" />
        </span>
      )}
    </div>
  );
}

/* ── Editor overlay for one sticker: rename, keywords, pack, favorite, delete ── */
function StickerEditor({ sticker, packs, onSave, onDelete, onClose, t }) {
  const [name, setName] = useState(sticker.name || '');
  const [keywords, setKeywords] = useState(sticker.keywords || []);
  const [packId, setPackId] = useState(sticker.pack_id || NO_PACK);
  const [favorite, setFavorite] = useState(!!sticker.is_favorite);
  const [kwInput, setKwInput] = useState('');
  const [saving, setSaving] = useState(false);

  const addKeyword = useCallback((raw) => {
    const parts = raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (!parts.length) return;
    setKeywords((prev) => [...new Set([...prev, ...parts])].slice(0, 10));
    setKwInput('');
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave(sticker.id, {
        name: name.trim(),
        keywords,
        pack_id: packId === NO_PACK ? null : packId,
        is_favorite: favorite,
      });
    } finally {
      setSaving(false);
    }
  }, [onSave, sticker.id, name, keywords, packId, favorite]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="absolute inset-0 z-10 flex flex-col bg-ink-850"
    >
      <div className="flex items-center gap-2 border-b border-ink-400/30 px-2 py-1.5">
        <button type="button" onClick={onClose} className="rounded-md p-1 text-ink-100 transition-colors hover:bg-ink-750 hover:text-foreground" aria-label={t('common.back')}>
          <ChevronLeft size={18} />
        </button>
        <span className="text-[13px] font-semibold">{t('sticker.editSticker')}</span>
        <button
          type="button"
          onClick={() => setFavorite((f) => !f)}
          className={['ml-auto rounded-md p-1.5 transition-colors', favorite ? 'text-amber-400' : 'text-ink-200 hover:text-foreground'].join(' ')}
          aria-label={t('sticker.favorite')}
        >
          <Star size={17} fill={favorite ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <div className="flex justify-center">
          <div className="echo-checker flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg p-1.5">
            <img src={sticker.url} alt="" className="max-h-full max-w-full object-contain" />
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-300">{t('sticker.name')}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder={t('sticker.namePlaceholder')}
            className="w-full rounded-lg bg-ink-750 px-2.5 py-2 text-[14px] text-foreground outline-none placeholder:text-ink-200 focus:ring-1 focus:ring-accent/60"
          />
        </label>

        <div>
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-300">{t('sticker.keywords')}</span>
          {keywords.length > 0 && (
            <div className="mb-1.5 flex flex-wrap gap-1">
              {keywords.map((k) => (
                <span key={k} className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[12px] text-accent">
                  {k}
                  <button type="button" onClick={() => setKeywords((prev) => prev.filter((x) => x !== k))} aria-label={t('common.remove')}>
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <input
            value={kwInput}
            onChange={(e) => setKwInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addKeyword(kwInput); } }}
            onBlur={() => addKeyword(kwInput)}
            placeholder={t('sticker.keywordsPlaceholder')}
            className="w-full rounded-lg bg-ink-750 px-2.5 py-2 text-[14px] text-foreground outline-none placeholder:text-ink-200 focus:ring-1 focus:ring-accent/60"
          />
        </div>

        <Select
          className="w-full"
          fullWidth
          variant="secondary"
          value={packId}
          onChange={(v) => setPackId(v == null ? NO_PACK : String(v))}
          placeholder={t('sticker.noPack')}
        >
          <Label>{t('sticker.pack')}</Label>
          <Select.Trigger className="w-full">
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id={NO_PACK} textValue={t('sticker.noPack')}>
                {t('sticker.noPack')}
                <ListBox.ItemIndicator />
              </ListBox.Item>
              {packs.map((p) => (
                <ListBox.Item key={p.id} id={p.id} textValue={p.name}>
                  {p.name}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      <div className="flex items-center gap-2 border-t border-ink-400/30 p-2">
        <Button
          variant="ghost"
          onPress={() => onDelete(sticker)}
          className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold text-danger transition-colors hover:bg-danger/10"
        >
          <Trash2 size={15} /> {t('common.delete')}
        </Button>
        <Button
          onPress={handleSave}
          isDisabled={saving}
          className="ml-auto flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} {t('common.save')}
        </Button>
      </div>
    </motion.div>
  );
}

/* ── Sticker collection panel ── */
function StickerPanel({
  collection, loading, uploading, managing, searching,
  activePack, onActivePack, onPick, onEdit, onAdd,
  onCreatePack, onRenamePack, onDeletePack, t,
}) {
  const { packs, stickers, recents } = collection;
  const [creatingPack, setCreatingPack] = useState(false);
  const [packName, setPackName] = useState('');

  // Which stickers to show given the active chip (ignored while searching).
  const visible = useMemo(() => {
    if (searching) return stickers;
    if (activePack === 'fav') return stickers.filter((s) => s.is_favorite);
    if (activePack === 'all') return stickers;
    return stickers.filter((s) => s.pack_id === activePack);
  }, [stickers, activePack, searching]);

  const activePackObj = packs.find((p) => p.id === activePack) || null;

  if (loading) {
    return <div className="flex h-full items-center justify-center text-ink-200"><Loader2 size={22} className="animate-spin" /></div>;
  }

  const submitPack = () => {
    const name = packName.trim();
    if (name) onCreatePack(name);
    setPackName('');
    setCreatingPack(false);
  };

  const hasFavorites = stickers.some((s) => s.is_favorite);

  return (
    <div className="flex h-full flex-col">
      {/* Pack chips — hidden while searching */}
      {!searching && (
        <div className="flex items-center gap-1.5 overflow-x-auto px-0.5 pb-2 [scrollbar-width:none]">
          <PackChip active={activePack === 'all'} onClick={() => onActivePack('all')}>{t('sticker.all')}</PackChip>
          {hasFavorites && (
            <PackChip active={activePack === 'fav'} onClick={() => onActivePack('fav')}>
              <Star size={12} className="mr-0.5 inline" fill="currentColor" />{t('sticker.favorites')}
            </PackChip>
          )}
          {packs.map((p) => (
            <PackChip key={p.id} active={activePack === p.id} onClick={() => onActivePack(p.id)}>{p.name}</PackChip>
          ))}
          {creatingPack ? (
            <input
              autoFocus
              value={packName}
              onChange={(e) => setPackName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitPack(); if (e.key === 'Escape') { setCreatingPack(false); setPackName(''); } }}
              onBlur={submitPack}
              maxLength={80}
              placeholder={t('sticker.newPack')}
              className="h-7 w-24 shrink-0 rounded-full bg-ink-750 px-3 text-[12px] text-foreground outline-none placeholder:text-ink-200"
            />
          ) : (
            <button
              type="button"
              onClick={() => setCreatingPack(true)}
              title={t('sticker.newPack')}
              className="echo-press flex h-7 shrink-0 items-center gap-1 rounded-full border border-dashed border-ink-400/60 px-2.5 text-[12px] font-medium text-ink-200 transition-colors hover:border-accent/70 hover:text-accent"
            >
              <FolderPlus size={13} />
            </button>
          )}
        </div>
      )}

      {/* Pack toolbar: manage a selected pack */}
      {!searching && activePackObj && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-ink-800/60 px-2 py-1">
          <span className="truncate text-[12px] font-semibold text-ink-100">{activePackObj.name}</span>
          <button type="button" onClick={() => onRenamePack(activePackObj)} className="ml-auto rounded p-1 text-ink-200 transition-colors hover:text-foreground" aria-label={t('sticker.renamePack')}>
            <Pencil size={13} />
          </button>
          <button type="button" onClick={() => onDeletePack(activePackObj)} className="rounded p-1 text-ink-200 transition-colors hover:text-danger" aria-label={t('sticker.deletePack')}>
            <Trash2 size={13} />
          </button>
        </div>
      )}

      {/* Recents — only on the "all" view without an active search */}
      {!searching && activePack === 'all' && recents.length > 0 && (
        <div className="mb-2">
          <span className="mb-1 block px-0.5 text-[11px] font-medium uppercase tracking-wide text-ink-300">{t('sticker.recents')}</span>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {recents.map((s) => (
              <button
                key={`r-${s.id}`}
                type="button"
                onClick={() => onPick(s)}
                title={s.name || t('sticker.send')}
                className="echo-checker echo-press flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg p-1"
              >
                <img src={s.url} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main grid */}
      <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-3 content-start gap-2 overflow-y-auto">
        {/* Add tile — only on "all" view, not while searching */}
        {!searching && activePack === 'all' && (
          <button
            type="button"
            onClick={onAdd}
            disabled={uploading}
            className="echo-press flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-ink-400/60 text-ink-200 transition-colors hover:border-accent/70 hover:text-accent disabled:opacity-60"
          >
            {uploading ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
            <span className="text-[11px] font-medium">{t('sticker.add')}</span>
          </button>
        )}

        {visible.length === 0 && !uploading && (
          <div className="col-span-3 flex flex-col items-center justify-center gap-1 px-2 py-8 text-center text-ink-200">
            <Sticker size={22} className="opacity-50" />
            <p className="text-[12px] leading-snug">{searching ? t('sticker.noResults') : t('sticker.empty')}</p>
          </div>
        )}

        {visible.map((s) => (
          <StickerTile key={s.id} sticker={s} managing={managing} onPick={onPick} onEdit={onEdit} t={t} />
        ))}
      </div>
    </div>
  );
}

function PackChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'echo-press h-7 shrink-0 whitespace-nowrap rounded-full px-3 text-[12px] font-semibold transition-colors',
        active ? 'bg-accent/15 text-accent' : 'bg-ink-800 text-ink-100 hover:bg-ink-750 hover:text-foreground',
      ].join(' ')}
    >
      {children}
    </button>
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

  // Sticker collection state
  const [collection, setCollection] = useState(EMPTY_COLLECTION);
  const [stickersLoaded, setStickersLoaded] = useState(false);
  const [stickersLoading, setStickersLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [managing, setManaging] = useState(false);
  const [activePack, setActivePack] = useState('all');
  const [editing, setEditing] = useState(null);

  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const abortRef = useRef(null);
  const fileRef = useRef(null);

  const needsKey = kind === 'gif' && !GIPHY_ENABLED;
  const searching = kind === 'sticker' && query.trim().length > 0;

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!rootRef.current || rootRef.current.contains(e.target) || isPortaledOverlay(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (editing) setEditing(null);
      else setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, editing]);

  // Load the collection (optionally filtered by a search query).
  const loadCollection = useCallback(async (search = '') => {
    setStickersLoading(true);
    try {
      const { data } = await stickerApi.list(search);
      setCollection(data || EMPTY_COLLECTION);
    } catch {
      setCollection(EMPTY_COLLECTION);
    } finally {
      setStickersLoading(false);
      setStickersLoaded(true);
    }
  }, []);

  // (Re)load stickers when the tab is active — debounced on the search query.
  useEffect(() => {
    if (!open || kind !== 'sticker') return;
    const q = query.trim();
    const timer = setTimeout(() => loadCollection(q), q ? 300 : 0);
    return () => clearTimeout(timer);
  }, [open, kind, query, loadCollection]);

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

  const handlePickGif = useCallback((item) => { onPick(item); setOpen(false); }, [onPick, setOpen]);

  // Send a custom sticker and record its usage (feeds the recents row).
  const handlePickSticker = useCallback((s) => {
    stickerApi.use(s.id).catch(() => {});
    onPick({ source: 'custom', kind: 'sticker', object_id: s.object_id, url: s.url, width: s.width, height: s.height });
    setOpen(false);
  }, [onPick, setOpen]);

  const switchKind = useCallback((k) => {
    setKind(k);
    setManaging(false);
    setQuery('');
    if (k === 'gif') searchRef.current?.focus();
  }, []);

  // Upload a new custom sticker (animated formats allowed; deduped server-side).
  const handleFilePicked = useCallback(async (file) => {
    if (!file) return;
    if (!STICKER_MIMES.includes(file.type)) { toast.danger(t('sticker.notImage')); return; }
    if (file.size > MAX_STICKER_BYTES) { toast.danger(t('sticker.tooBig')); return; }
    setUploading(true);
    try {
      const { width, height } = await readImageSize(file);
      await stickerApi.upload(file, {
        ...(width ? { image_width: width } : {}),
        ...(height ? { image_height: height } : {}),
      });
      await loadCollection(query.trim());
    } catch (err) {
      console.error('Sticker upload failed:', err);
      toast.danger(t('sticker.uploadError'));
    } finally {
      setUploading(false);
    }
  }, [t, loadCollection, query]);

  const handleSaveEdit = useCallback(async (id, fields) => {
    try {
      await stickerApi.update(id, fields);
      setEditing(null);
      await loadCollection(query.trim());
    } catch (err) {
      console.error('Sticker update failed:', err);
      toast.danger(t('sticker.uploadError'));
    }
  }, [loadCollection, query, t]);

  const handleDeleteSticker = useCallback(async (s) => {
    setEditing(null);
    try {
      await stickerApi.remove(s.id);
      await loadCollection(query.trim());
    } catch (err) {
      console.error('Sticker delete failed:', err);
      loadCollection(query.trim());
    }
  }, [loadCollection, query]);

  const handleCreatePack = useCallback(async (name) => {
    try {
      const { data } = await stickerApi.createPack(name);
      await loadCollection(query.trim());
      if (data?.id) setActivePack(data.id);
    } catch (err) {
      console.error('Pack create failed:', err);
    }
  }, [loadCollection, query]);

  const handleRenamePack = useCallback(async (pack) => {
    const name = window.prompt(t('sticker.renamePack'), pack.name);
    if (!name || !name.trim() || name.trim() === pack.name) return;
    try {
      await stickerApi.renamePack(pack.id, name.trim());
      await loadCollection(query.trim());
    } catch (err) {
      console.error('Pack rename failed:', err);
    }
  }, [loadCollection, query, t]);

  const handleDeletePack = useCallback(async (pack) => {
    try {
      await stickerApi.deletePack(pack.id);
      setActivePack('all');
      await loadCollection(query.trim());
    } catch (err) {
      console.error('Pack delete failed:', err);
    }
  }, [loadCollection, query]);

  const showStickerSearch = kind === 'sticker' && (stickersLoaded ? (collection.stickers.length > 0 || query) : false);

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

            {/* Search bar (GIFs always; stickers when there's a collection) */}
            {((kind === 'gif' && !needsKey) || showStickerSearch) && (
              <div className="p-1.5">
                <div className="flex items-center gap-2 rounded-lg bg-ink-750 px-2.5">
                  <Search size={15} className="shrink-0 text-ink-200" />
                  <input
                    ref={searchRef}
                    autoFocus={kind === 'gif'}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t(kind === 'gif' ? 'sticker.searchGifs' : 'sticker.searchStickers')}
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

            {/* Sticker manage toggle */}
            {kind === 'sticker' && !searching && collection.stickers.length > 0 && (
              <div className="flex items-center justify-between px-2.5 pb-1">
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
                  {managing ? <><Check size={13} />{t('sticker.done')}</> : <><Pencil size={13} />{t('sticker.manage')}</>}
                </button>
              </div>
            )}

            {/* Body */}
            <div className="relative min-h-0 flex-1 overflow-hidden px-1.5 pb-1.5">
              {kind === 'gif' ? (
                <div className="h-full overflow-y-auto">
                  <GifGrid items={gifs} loading={gifLoading} error={gifError} needsKey={needsKey} onPick={handlePickGif} t={t} />
                </div>
              ) : (
                <StickerPanel
                  collection={collection}
                  loading={stickersLoading && !stickersLoaded}
                  uploading={uploading}
                  managing={managing}
                  searching={searching}
                  activePack={activePack}
                  onActivePack={setActivePack}
                  onPick={handlePickSticker}
                  onEdit={setEditing}
                  onAdd={() => fileRef.current?.click()}
                  onCreatePack={handleCreatePack}
                  onRenamePack={handleRenamePack}
                  onDeletePack={handleDeletePack}
                  t={t}
                />
              )}

              <AnimatePresence>
                {editing && (
                  <StickerEditor
                    sticker={editing}
                    packs={collection.packs}
                    onSave={handleSaveEdit}
                    onDelete={handleDeleteSticker}
                    onClose={() => setEditing(null)}
                    t={t}
                  />
                )}
              </AnimatePresence>
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
              accept="image/webp,image/png,image/gif,image/jpeg"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFilePicked(f); e.target.value = ''; }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
