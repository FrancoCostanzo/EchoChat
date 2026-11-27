import { ExternalLink, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LocationMap from '@/components/conversation/LocationMap';
import { mapLink } from '@/lib/maps';

/** Burbuja de un mensaje de ubicación: mini-mapa, etiqueta, coordenadas y link al mapa. */
export default function LocationMessage({ lat, lng, label, variant }: {
  lat: number; lng: number; label?: string | null; variant: 'own' | 'other';
}) {
  const { t } = useTranslation();
  const isOwn = variant === 'own';
  const coords = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

  return (
    <a
      href={mapLink(lat, lng)}
      target="_blank"
      rel="noopener noreferrer"
      className="group block overflow-hidden rounded-lg"
      aria-label={t('location.openInMap')}
    >
      <LocationMap lat={lat} lng={lng} />
      <div className={`flex items-center gap-2 px-2 py-1.5 ${isOwn ? 'bg-black/15' : 'bg-ink-800/70'}`}>
        <MapPin size={14} className={`shrink-0 ${isOwn ? 'text-white/80' : 'echo-accent-fg'}`} />
        <div className="min-w-0 flex-1">
          {label && <p className={`truncate text-[13px] font-medium ${isOwn ? 'text-white' : 'text-foreground'}`}>{label}</p>}
          <p className={`truncate text-[11px] ${isOwn ? 'text-white/75' : 'text-ink-200'}`}>{coords}</p>
        </div>
        <ExternalLink size={13} className={`shrink-0 opacity-60 group-hover:opacity-100 ${isOwn ? 'text-white' : 'text-ink-100'}`} />
      </div>
    </a>
  );
}
