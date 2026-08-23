import { useState, useCallback, useEffect, useRef } from 'react';
import Cropper, { type Area, type Point } from 'react-easy-crop';
import { Modal, Button, Spinner } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { getCroppedAvatarFile } from '@/lib/avatarCrop';

interface AvatarCropModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  fileName?: string;
  onClose: () => void;
  onConfirm: (file: File) => Promise<void> | void;
  loading?: boolean;
}

export default function AvatarCropModal({
  isOpen,
  imageSrc,
  fileName = 'avatar.jpg',
  onClose,
  onConfirm,
  loading = false,
}: AvatarCropModalProps) {
  const { t } = useTranslation();
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const croppedPixelsRef = useRef<Area | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      croppedPixelsRef.current = null;
      setSubmitting(false);
    }
  }, [isOpen, imageSrc]);

  const onCropAreaChange = useCallback((_area: Area, pixels: Area) => {
    croppedPixelsRef.current = pixels;
    setCroppedAreaPixels(pixels);
  }, []);

  const handleConfirm = async () => {
    const pixels = croppedPixelsRef.current || croppedAreaPixels;
    if (!imageSrc || !pixels || submitting || loading) return;
    setSubmitting(true);
    try {
      const file = await getCroppedAvatarFile(imageSrc, pixels, fileName);
      await onConfirm(file);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && !loading && !submitting) onClose();
  };

  const busy = loading || submitting;

  return (
    <Modal isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="md">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>{t('settings.avatarCropTitle')}</Modal.Heading>
              <Modal.CloseTrigger />
            </Modal.Header>

            <Modal.Body className="flex flex-col gap-4">
              <p className="text-sm text-muted">{t('settings.avatarCropHint')}</p>

              <div className="relative h-72 w-full touch-none select-none overflow-hidden rounded-xl bg-black/80">
                {imageSrc && (
                  <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    cropShape="round"
                    showGrid={false}
                    objectFit="contain"
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropAreaChange={onCropAreaChange}
                    style={{ containerStyle: { width: '100%', height: '100%' } }}
                  />
                )}
              </div>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-medium text-muted">{t('settings.avatarCropZoom')}</span>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full accent-accent"
                  aria-label={t('settings.avatarCropZoom')}
                />
              </label>
            </Modal.Body>

            <Modal.Footer>
              <Button variant="ghost" onPress={onClose} isDisabled={busy}>
                {t('common.cancel')}
              </Button>
              <Button
                onPress={handleConfirm}
                isDisabled={!imageSrc || busy}
                isPending={busy}
                className="bg-accent text-accent-foreground"
              >
                {busy && <Spinner size="sm" color="current" />}
                {t('settings.avatarCropConfirm')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
