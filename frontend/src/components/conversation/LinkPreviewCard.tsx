import { useState } from 'react';
import type { LinkPreview } from '@/types/message';

/**
 * Tarjeta bajo el texto con la vista previa del primer link (título,
 * descripción, imagen y sitio). La arma el backend: llega con el mensaje o
 * después, por `message:link_preview`.
 */
export default function LinkPreviewCard({ preview, variant }: { preview: LinkPreview; variant: 'own' | 'other' }) {
  const [imageFailed, setImageFailed] = useState(false);
  const isOwn = variant === 'own';
  const showImage = !!preview.image_url && !imageFailed;

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className={[
        'mt-1.5 flex max-w-[min(360px,70vw)] flex-col overflow-hidden rounded-lg border-l-[3px] transition-colors',
        isOwn
          ? 'border-white/60 bg-black/15 hover:bg-black/25'
          : 'border-accent bg-ink-800/70 hover:bg-ink-750',
      ].join(' ')}
    >
      {showImage && (
        <img
          src={preview.image_url!}
          alt=""
          loading="lazy"
          decoding="async"
          // Sin Referer: el sitio de la imagen no se entera desde qué chat se abrió.
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
          className="max-h-44 w-full object-cover"
        />
      )}
      <div className="flex flex-col gap-0.5 px-2.5 py-1.5">
        {preview.site_name && (
          <span className={`truncate text-[11px] font-medium ${isOwn ? 'text-white/75' : 'echo-accent-fg'}`}>
            {preview.site_name}
          </span>
        )}
        {preview.title && (
          <span className={`line-clamp-2 text-[13px] font-semibold leading-snug ${isOwn ? 'text-white' : 'text-foreground'}`}>
            {preview.title}
          </span>
        )}
        {preview.description && (
          <span className={`line-clamp-2 text-[12px] leading-snug ${isOwn ? 'text-white/80' : 'text-ink-200'}`}>
            {preview.description}
          </span>
        )}
      </div>
    </a>
  );
}
