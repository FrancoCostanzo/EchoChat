/**
 * Contrato de /preferences/wallpapers. Sin model.ts propio en el backend (ver
 * la nota en types/broadcast.ts) — sólo se tipa el request
 * (backend/src/dtos/wallpaper.dto.ts). Ver la nota de sincronización en
 * types/user.ts.
 */
export interface UpsertWallpaperRequest {
  scope: 'global' | 'type' | 'conversation';
  /**
   * Depende de `scope`: la palabra 'global', un tipo de conversación, o el id
   * de una conversación.
   */
  scope_key: string;
  wallpaper_type: 'preset' | 'color' | 'image';
  wallpaper_value?: string | null;
  /** Obligatorio cuando `wallpaper_type` es 'image'. */
  storage_object_id?: string | null;
}

/** La fila persistida: el upsert request más lo que agrega la base (id, timestamps). */
export interface WallpaperEntry extends UpsertWallpaperRequest {
  id: string;
  created_at?: string | null;
  updated_at?: string | null;
}
