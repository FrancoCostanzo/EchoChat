import BaseRepository from './base.repository';
import { upsert, insertIgnore } from '../config/db/upsert';
import { now } from '../config/db/sql';
import type { Row } from '../types/rows';

export type PushSubscriptionRow = Row<'push_subscriptions'>;

class PushSubscriptionRepository extends BaseRepository<PushSubscriptionRow> {
  constructor() {
    super('push_subscriptions');
  }

  /**
   * Alta o refresco de una suscripción. El endpoint identifica al navegador:
   * si ya existía (otra cuenta en el mismo navegador, o claves renovadas) se
   * reasigna al usuario actual y se resetea el contador de fallos.
   */
  async upsert(
    userId: string,
    { endpoint, p256dh, auth, userAgent }: { endpoint: string; p256dh: string; auth: string; userAgent: string | null },
  ): Promise<PushSubscriptionRow> {
    const values = { user_id: userId, p256dh, auth, user_agent: userAgent };
    const row = await upsert(this.db, { table: 'push_subscriptions', values: { endpoint, ...values }, conflict: ['endpoint'], update: { ...values, failure_count: 0 }, returning: true });
    return row as PushSubscriptionRow;
  }

  async findByUser(userId: string): Promise<PushSubscriptionRow[]> {
    return this.db.selectFrom('push_subscriptions').selectAll()
      .where('user_id', '=', userId)
      .orderBy('created_at', 'desc')
      .execute() as Promise<PushSubscriptionRow[]>;
  }

  /** De `userIds`, los que tienen al menos un dispositivo suscripto. */
  async filterSubscribedUserIds(userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) return [];
    const rows = await this.db.selectFrom('push_subscriptions').select('user_id').distinct()
      .where('user_id', 'in', userIds)
      .execute();
    return rows.map((r) => r.user_id);
  }

  async deleteForUser(userId: string, id: string): Promise<boolean> {
    const result = await this.db.deleteFrom('push_subscriptions')
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .executeTakeFirst();
    return Number(result.numDeletedRows) > 0;
  }

  async deleteByEndpoint(endpoint: string, userId?: string): Promise<void> {
    let q = this.db.deleteFrom('push_subscriptions').where('endpoint', '=', endpoint);
    if (userId) q = q.where('user_id', '=', userId);
    await q.execute();
  }

  async markDelivered(id: string): Promise<void> {
    await this.db.updateTable('push_subscriptions')
      .set({ last_used_at: now(), failure_count: 0 })
      .where('id', '=', id)
      .execute();
  }

  /** Suma un fallo; pasado el tope la suscripción se da por muerta y se borra. */
  async markFailed(id: string, maxFailures: number): Promise<void> {
    const row = await this.db.updateTable('push_subscriptions')
      .set((eb) => ({ failure_count: eb('failure_count', '+', 1) }))
      .where('id', '=', id)
      .returning('failure_count')
      .executeTakeFirst();
    if (row && Number(row.failure_count) >= maxFailures) {
      await this.db.deleteFrom('push_subscriptions').where('id', '=', id).execute();
    }
  }
}

export default new PushSubscriptionRepository();
