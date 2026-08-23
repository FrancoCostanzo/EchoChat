/**
 * Contrato de /relationships. Sin model.ts propio en el backend (ver la nota
 * en types/broadcast.ts) — el request se tipa desde
 * backend/src/dtos/relationship.dto.ts; la respuesta de las listas
 * (getContacts/getBlocked/getFavorites) desde
 * backend/src/repositories/relationship.repository.ts
 * (RelationshipWithUser) + el resuelve-avatar de relationship.service.ts.
 * Ver la nota de sincronización en types/user.ts.
 */
export interface RelationshipRequest {
  target_user_id: string;
  type: 'contact' | 'blocked' | 'favorite';
  alias?: string | null;
}

/** Fila de user_relationships + los datos del usuario destino que trae el JOIN. */
export interface RelationshipEntry {
  id: string;
  user_id: string;
  target_user_id: string;
  type: 'contact' | 'blocked' | 'favorite';
  alias: string | null;
  created_at: string | null;
  username: string;
  display_name: string;
  department: string | null;
  avatar_bucket: string | null;
  avatar_object_key: string | null;
  presence: string | null;
  /** Resuelta por relationship.service.ts cuando hay avatar_object_key. */
  avatar_url?: string;
}
