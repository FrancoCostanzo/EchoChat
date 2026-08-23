/**
 * Contrato de /stickers. Fuente de verdad en el backend:
 * backend/src/models/sticker.model.ts (toUserStickerResponse,
 * toStickerPackResponse). Ver la nota de sincronización en types/user.ts.
 */
export interface UserStickerResponse {
  id: string;
  object_id: string;
  url: string | null;
  name: string | null;
  keywords: string[];
  pack_id: string | null;
  is_favorite: boolean;
  width: number | null;
  height: number | null;
  mime_type: string | null;
}

export interface StickerPackResponse {
  id: string;
  name: string;
  position: number;
}

/** GET /stickers: la colección personal completa, no una lista plana. */
export interface StickerCollection {
  packs: StickerPackResponse[];
  stickers: UserStickerResponse[];
  recents: UserStickerResponse[];
}

export interface SaveStickerRequest {
  object_id: string;
}

export interface UpdateStickerRequest {
  name?: string | null;
  keywords?: string[];
  pack_id?: string | null;
  is_favorite?: boolean;
}

export interface CreatePackRequest {
  name: string;
}

export interface UpdatePackRequest {
  name?: string;
  position?: number;
}
