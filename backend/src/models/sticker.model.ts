import type { Row } from '../types/rows';

/** Sticker con las columnas que aporta el JOIN contra `storage_objects`. */
export type UserStickerRow = Row<'user_stickers'> & {
  image_width?: number | null;
  image_height?: number | null;
  mime_type?: string | null;
};

// Compact shapes for the sticker collection API. The presigned URL is resolved
// by the service and passed in (repository rows only carry storage_object_id).
export function toUserStickerResponse(row: UserStickerRow | null | undefined, url?: string | null) {
  if (!row) return null;
  return {
    id: row.id,
    object_id: row.storage_object_id,
    url: url || null,
    name: row.name || null,
    keywords: row.keywords || [],
    pack_id: row.pack_id || null,
    is_favorite: !!row.is_favorite,
    width: row.image_width || null,
    height: row.image_height || null,
    mime_type: row.mime_type || null,
  };
}

/**
 * Sólo pide los campos que expone: los repositorios devuelven proyecciones sin
 * `owner_id`, y exigir la fila completa obligaría a leer columnas que la
 * respuesta ni siquiera muestra.
 */
type PackLike = Pick<Row<'sticker_packs'>, 'id' | 'name' | 'position'>;

export function toStickerPackResponse(row: PackLike | null | undefined) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    position: row.position,
  };
}

export type UserStickerResponse = NonNullable<ReturnType<typeof toUserStickerResponse>>;
export type StickerPackResponse = NonNullable<ReturnType<typeof toStickerPackResponse>>;
