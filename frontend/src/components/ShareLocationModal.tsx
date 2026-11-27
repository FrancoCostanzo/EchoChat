import { useState } from 'react';
import { Modal, Button, Input } from '@heroui/react';
import { LocateFixed, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LocationMap from '@/components/conversation/LocationMap';

export interface SharedLocation {
  lat: number;
  lng: number;
  label: string | null;
}

interface ShareLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (location: SharedLocation) => void;
}

type GeoError = 'denied' | 'unavailable' | 'unsupported';

export default function ShareLocationModal({ isOpen, onClose, onSend }: ShareLocationModalProps) {
  const { t } = useTranslation();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [label, setLabel] = useState('');
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<GeoError | null>(null);

  const reset = () => {
    setCoords(null);
    setLabel('');
    setLocating(false);
    setError(null);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
      reset();
    }
  };

  const locate = () => {
    if (!('geolocation' in navigator)) {
      setError('unsupported');
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        });
        setLocating(false);
      },
      (err) => {
        setError(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };

  const send = () => {
    if (!coords) return;
    onSend({ ...coords, label: label.trim() || null });
    onClose();
    reset();
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="sm">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2">
                <MapPin size={16} /> {t('location.title')}
              </Modal.Heading>
              <Modal.CloseTrigger />
            </Modal.Header>

            <Modal.Body className="flex flex-col gap-3">
              {coords ? (
                <>
                  <div className="overflow-hidden rounded-lg">
                    <LocationMap lat={coords.lat} lng={coords.lng} width={320} height={170} />
                  </div>
                  <p className="text-xs text-ink-200">{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</p>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-ink-200">{t('location.label')}</label>
                    <Input
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder={t('location.labelPlaceholder')}
                      maxLength={200}
                    />
                  </div>
                </>
              ) : (
                <p className="text-sm text-ink-100">{t('location.hint')}</p>
              )}
              {error && <p className="text-sm text-echo-dnd">{t(`location.error.${error}`)}</p>}
              <Button variant="secondary" className="gap-2" isPending={locating} onPress={locate}>
                <LocateFixed size={15} /> {coords ? t('location.retry') : t('location.useMine')}
              </Button>
            </Modal.Body>

            <Modal.Footer>
              <Button className="w-full" isDisabled={!coords} onPress={send}>
                {t('location.send')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
