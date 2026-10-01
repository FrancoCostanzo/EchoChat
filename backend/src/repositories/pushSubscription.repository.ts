import BaseRepository from './base.repository';
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
    const { rows } = await this.query<PushSubscriptionRow>(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (endpoint) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           p256dh = EXCLUDED.p256dh,
           auth = EXCLUDED.auth,
           user_agent = EXCLUDED.user_agent,
           failure_count = 0
       RETURNING *`,
      [userId, endpoint, p256dh, auth, userAgent]
    );
    return rows[0];
  }

  async findByUser(userId: string): Promise<PushSubscriptionRow[]> {
    const { rows } = await this.query<PushSubscriptionRow>(
      'SELECT * FROM push_subscriptions WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return rows;
  }

  /** De `userIds`, los que tienen al menos un dispositivo suscripto. */
  async filterSubscribedUserIds(userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) return [];
    const { rows } = await this.query<{ user_id: string }>(
      'SELECT DISTINCT user_id FROM push_subscriptions WHERE user_id = ANY($1::uuid[])',
      [userIds]
    );
    return rows.map((r) => r.user_id);
  }

  async deleteForUser(userId: string, id: string): Promise<boolean> {
    const { rowCount } = await this.query(
      'DELETE FROM push_subscriptions WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return (rowCount ?? 0) > 0;
  }

  async deleteByEndpoint(endpoint: string, userId?: string): Promise<void> {
    if (userId) {
      await this.query('DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2', [endpoint, userId]);
    } else {
      await this.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
    }
  }

  async markDelivered(id: string): Promise<void> {
    await this.query(
      'UPDATE push_subscriptions SET last_used_at = NOW(), failure_count = 0 WHERE id = $1',
      [id]
    );
  }

  /** Suma un fallo; pasado el tope la suscripción se da por muerta y se borra. */
  async markFailed(id: string, maxFailures: number): Promise<void> {
    await this.query(
      `WITH upd AS (
         UPDATE push_subscriptions SET failure_count = failure_count + 1
         WHERE id = $1 RETURNING id, failure_count
       )
       DELETE FROM push_subscriptions p USING upd
       WHERE p.id = upd.id AND upd.failure_count >= $2`,
      [id, maxFailures]
    );
  }
}

export default new PushSubscriptionRepository();
