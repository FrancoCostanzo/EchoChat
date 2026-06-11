import { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Spinner, Modal, Label } from '@heroui/react';
import { Upload, X, Check, Trash2, Image as ImageIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWallpaperStore } from '@/stores/wallpaperStore';
import { storageApi } from '@/lib/endpoints';

export const PRESETS = [
  {
    key: 'midnight',
    background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
  },
  {
    key: 'aurora',
    background: 'linear-gradient(135deg, #0d324d 0%, #7f5a83 100%)',
  },
  {
    key: 'ember',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #e94560 100%)',
  },
  {
    key: 'forest',
    background: 'linear-gradient(135deg, #0a3d2e 0%, #1b6ca8 100%)',
  },
  {
    key: 'dusk',
    background: 'linear-gradient(135deg, #2c1654 0%, #f7971e 100%)',
  },
  {
    key: 'ocean',
    background: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
  },
  {
    key: 'rose',
    background: 'linear-gradient(135deg, #360033 0%, #0b8793 100%)',
  },
  {
    key: 'graphite',
    background: 'linear-gradient(135deg, #232526 0%, #414345 100%)',
  },
];

const SOLID_COLORS = [
  '#1a1a2e', '#0f0c29', '#0d1b2a', '#1b1b2f',
  '#2d2d44', '#1a2a1a', '#2a1a1a', '#1a1a1a',
];

/**
 * WallpaperPicker — modal picker for selecting a chat wallpaper.
 *
 * Props:
 *   isOpen      boolean
 *   onClose     () => void
 *   scope       'global' | 'type' | 'conversation'
 *   scopeKey    string
 *   label       string  — displayed in modal title
 */
export default function WallpaperPicker({ isOpen, onClose, scope, scopeKey, label }) {
  const { t } = useTranslation();
  const { wallpapers, setWallpaper, removeWallpaper } = useWallpaperStore();
  const fileInputRef = useRef(null);
  const pendingUploadRef = useRef(null); // uploaded in this session but not saved yet

  const [tab, setTab] = useState('presets'); // 'presets' | 'color' | 'image'
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedPreview, setUploadedPreview] = useState(null); // { objectId, url }
  const [selectedColor, setSelectedColor] = useState(SOLID_COLORS[0]);
  const [selectedPreset, setSelectedPreset] = useState(null);

  const current = wallpapers.find((w) => w.scope === scope && w.scope_key === scopeKey);
  const savedObjectId = current?.wallpaper_type === 'image' ? current.storage_object_id : null;

  const discardOrphanUpload = useCallback((objectId) => {
    if (!objectId || objectId === savedObjectId) return;
    storageApi.delete(objectId).catch(() => {});
  }, [savedObjectId]);

  const handleClose = useCallback(() => {
    discardOrphanUpload(pendingUploadRef.current);
    pendingUploadRef.current = null;
    onClose();
  }, [discardOrphanUpload, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    pendingUploadRef.current = null;
    if (current?.wallpaper_type === 'preset') {
      setTab('presets');
      setSelectedPreset(current.wallpaper_value);
    } else if (current?.wallpaper_type === 'color') {
      setTab('color');
      setSelectedColor(current.wallpaper_value);
    } else if (current?.wallpaper_type === 'image') {
      setTab('image');
      setUploadedPreview(
        current.storage_object_id
          ? { objectId: current.storage_object_id, url: null }
          : null
      );
    } else {
      setTab('presets');
      setSelectedPreset(null);
    }
  }, [isOpen, current]);

  const handleSavePreset = async () => {
    if (!selectedPreset) return;
    setSaving(true);
    try {
      await setWallpaper(scope, scopeKey, {
        wallpaper_type: 'preset',
        wallpaper_value: selectedPreset,
        storage_object_id: null,
      });
      handleClose();
    } finally {
      setSaving(false);
    }
  };

  const handleSaveColor = async () => {
    setSaving(true);
    try {
      await setWallpaper(scope, scopeKey, {
        wallpaper_type: 'color',
        wallpaper_value: selectedColor,
        storage_object_id: null,
      });
      handleClose();
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      discardOrphanUpload(pendingUploadRef.current);
      const { data } = await storageApi.upload(file, 'wallpaper');
      pendingUploadRef.current = data.id;
      const localUrl = URL.createObjectURL(file);
      setUploadedPreview({ objectId: data.id, url: localUrl });
    } catch {
      // ignore
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSaveImage = async () => {
    if (!uploadedPreview?.objectId) return;
    setSaving(true);
    try {
      await setWallpaper(scope, scopeKey, {
        wallpaper_type: 'image',
        wallpaper_value: null,
        storage_object_id: uploadedPreview.objectId,
      });
      pendingUploadRef.current = null;
      handleClose();
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    try {
      await removeWallpaper(scope, scopeKey);
      pendingUploadRef.current = null;
      handleClose();
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (tab === 'presets') return handleSavePreset();
    if (tab === 'color') return handleSaveColor();
    if (tab === 'image') return handleSaveImage();
  };

  const canSave =
    (tab === 'presets' && selectedPreset) ||
    (tab === 'color' && selectedColor) ||
    (tab === 'image' && uploadedPreview?.objectId);

  const TABS = [
    { key: 'presets', label: t('wallpaper.presets') },
    { key: 'color',   label: t('wallpaper.solidColor') },
    { key: 'image',   label: t('wallpaper.image') },
  ];

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="lg">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2">
                <ImageIcon size={16} className="text-accent" />
                {t('wallpaper.title')}{label ? ` — ${label}` : ''}
              </Modal.Heading>
              <Modal.CloseTrigger />
            </Modal.Header>

            <Modal.Body className="flex flex-col gap-4">
              {/* Tab strip */}
              <div className="flex gap-1 rounded-xl bg-ink-800/60 p-1">
                {TABS.map(({ key, label: tabLabel }) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={[
                      'flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                      tab === key
                        ? 'bg-accent text-accent-foreground shadow'
                        : 'text-ink-200 hover:text-foreground',
                    ].join(' ')}
                  >
                    {tabLabel}
                  </button>
                ))}
              </div>

              {/* Presets tab */}
              {tab === 'presets' && (
                <div className="grid grid-cols-4 gap-2">
                  {PRESETS.map(({ key, background }) => (
                    <button
                      key={key}
                      onClick={() => setSelectedPreset(key)}
                      className={[
                        'relative h-20 rounded-xl ring-2 transition-all',
                        selectedPreset === key
                          ? 'ring-accent scale-[1.04]'
                          : 'ring-transparent hover:ring-white/25',
                      ].join(' ')}
                      style={{ background }}
                      aria-label={t(`wallpaper.presetNames.${key}`)}
                    >
                      {selectedPreset === key && (
                        <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-foreground shadow">
                          <Check size={11} strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Solid color tab */}
              {tab === 'color' && (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-4 gap-2">
                    {SOLID_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setSelectedColor(color)}
                        className={[
                          'relative h-16 rounded-xl ring-2 transition-all',
                          selectedColor === color
                            ? 'ring-accent scale-[1.04]'
                            : 'ring-transparent hover:ring-white/25',
                        ].join(' ')}
                        style={{ backgroundColor: color }}
                        aria-label={color}
                      >
                        {selectedColor === color && (
                          <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-foreground shadow">
                            <Check size={11} strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <Label className="shrink-0 text-sm text-ink-200">{t('wallpaper.customColor')}</Label>
                    <input
                      type="color"
                      value={selectedColor}
                      onChange={(e) => setSelectedColor(e.target.value)}
                      className="h-9 w-16 cursor-pointer rounded-lg border border-white/10 bg-transparent p-0.5"
                    />
                    <span className="font-mono text-xs text-ink-300">{selectedColor}</span>
                  </div>
                </div>
              )}

              {/* Image tab */}
              {tab === 'image' && (
                <div className="flex flex-col items-center gap-4">
                  {uploadedPreview?.url ? (
                    <div className="relative w-full overflow-hidden rounded-xl">
                      <img
                        src={uploadedPreview.url}
                        alt={t('wallpaper.preview')}
                        className="max-h-48 w-full object-cover"
                      />
                      <button
                        onClick={() => setUploadedPreview(null)}
                        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-ink-900/80 text-foreground hover:bg-ink-800"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-white/15 py-10 text-ink-200 transition-colors hover:border-accent/40 hover:text-foreground disabled:opacity-50"
                    >
                      {uploading ? (
                        <Spinner size="md" />
                      ) : (
                        <Upload size={28} />
                      )}
                      <span className="text-sm font-medium">
                        {uploading ? t('wallpaper.uploading') : t('wallpaper.uploadHint')}
                      </span>
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              )}

              {/* Current wallpaper preview strip */}
              {current && (
                <div className="flex items-center justify-between rounded-lg bg-ink-800/50 px-3 py-2">
                  <span className="text-xs text-ink-200">{t('wallpaper.currentlySet')}</span>
                  <button
                    onClick={handleRemove}
                    disabled={saving}
                    className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-danger hover:bg-danger/10"
                  >
                    <Trash2 size={12} />
                    {t('wallpaper.remove')}
                  </button>
                </div>
              )}
            </Modal.Body>

            <Modal.Footer>
              <Button variant="ghost" onPress={handleClose} isDisabled={saving}>
                {t('common.cancel')}
              </Button>
              <Button
                onPress={handleSave}
                isDisabled={!canSave || saving}
                isLoading={saving}
                className="bg-accent text-accent-foreground"
              >
                {t('common.save')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

/** Small inline preview swatch for a given wallpaper entry. */
export function WallpaperPreview({ wallpaper, className = '' }) {
  if (!wallpaper) {
    return (
      <span
        className={`block rounded-md border border-white/10 bg-ink-700 ${className}`}
        aria-label="default"
      />
    );
  }

  if (wallpaper.wallpaper_type === 'preset') {
    const preset = PRESETS.find((p) => p.key === wallpaper.wallpaper_value);
    return (
      <span
        className={`block rounded-md ${className}`}
        style={{ background: preset?.background ?? '#1a1a2e' }}
      />
    );
  }

  if (wallpaper.wallpaper_type === 'color') {
    return (
      <span
        className={`block rounded-md ${className}`}
        style={{ backgroundColor: wallpaper.wallpaper_value }}
      />
    );
  }

  return (
    <span className={`flex items-center justify-center rounded-md bg-ink-700 ${className}`}>
      <ImageIcon size={14} className="text-ink-300" />
    </span>
  );
}
