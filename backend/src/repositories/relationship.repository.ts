import BaseRepository from './base.repository';
import type { Row } from '../types/rows';

type RelationshipRow = Row<'user_relationships'>;

/** Relación con los datos del usuario destino que trae el JOIN. */
export type RelationshipWithUser = RelationshipRow & {
  username: string;
  display_name: string;
  department: string | null;
  avatar_bucket: string | null;
  avatar_object_key: string | null;
  presence: string | null;
};

class RelationshipRepository extends BaseRepository<RelationshipRow> {
  constructor() {
    super('user_relationships');
  }

  async create(
    { user_id, target_user_id, type, alias }: {
      user_id: string;
      target_user_id: string;
      type: string;
      alias?: string | null;
    },
  ): Promise<RelationshipRow> {
    const row = await this.db.insertInto('user_relationships')
      .values({ user_id, target_user_id, type, alias: alias || null })
      .onConflict((oc) => oc.columns(['user_id', 'target_user_id', 'type']).doUpdateSet({ alias: alias || null }))
      .returningAll()
      .executeTakeFirst();
    return row as RelationshipRow;
  }

  async remove(userId: string, targetUserId: string, type: string): Promise<boolean> {
    const result = await this.db.deleteFrom('user_relationships')
      .where('user_id', '=', userId)
      .where('target_user_id', '=', targetUserId)
      .where('type', '=', type)
      .executeTakeFirst();
    return Number(result.numDeletedRows) > 0;
  }

  async findByUser(userId: string, type: string | null = null): Promise<RelationshipWithUser[]> {
    let q = this.db.selectFrom('user_relationships as ur')
      .innerJoin('users as u', 'u.id', 'ur.target_user_id')
      .selectAll('ur')
      .select(['u.username', 'u.display_name', 'u.department', 'u.avatar_bucket', 'u.avatar_object_key', 'u.presence'])
      .where('ur.user_id', '=', userId);
    if (type) q = q.where('ur.type', '=', type);
    return q.orderBy('u.display_name').execute() as unknown as Promise<RelationshipWithUser[]>;
  }

  /** ¿`userId` tiene a `targetUserId` entre sus contactos o favoritos? */
  async hasContact(userId: string, targetUserId: string): Promise<boolean> {
    const row = await this.db.selectFrom('user_relationships').select('id')
      .where('user_id', '=', userId)
      .where('target_user_id', '=', targetUserId)
      .where('type', 'in', ['contact', 'favorite'])
      .limit(1)
      .executeTakeFirst();
    return !!row;
  }

  async isBlocked(userId: string, targetUserId: string): Promise<boolean> {
    const row = await this.db.selectFrom('user_relationships').select('id')
      .where('user_id', '=', userId)
      .where('target_user_id', '=', targetUserId)
      .where('type', '=', 'blocked')
      .executeTakeFirst();
    return !!row;
  }
}

export default new RelationshipRepository();
