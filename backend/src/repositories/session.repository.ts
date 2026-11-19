import BaseRepository from './base.repository';
import { now, nowMinus } from '../config/db/sql';
import type { Row } from '../types/rows';

type SessionRow = Row<'user_sessions'>;

/** Proyección que se le muestra al usuario: nunca incluye el token_hash. */
export type SessionSummary = Pick<
  SessionRow,
  'id' | 'device_name' | 'device_type' | 'ip_address' | 'user_agent' | 'last_activity' | 'created_at'
>;

class SessionRepository extends BaseRepository<SessionRow> {
  constructor() {
    super('user_sessions');
  }

  async create(
    { userId, tokenHash, deviceName, deviceType, ipAddress, userAgent, expiresAt }: {
      userId: string;
      tokenHash: string;
      deviceName?: string | null;
      deviceType?: string | null;
      ipAddress?: string | null;
      userAgent?: string | null;
      expiresAt: Date;
    },
  ): Promise<SessionRow> {
    const row = await this.db.insertInto('user_sessions')
      .values({
        user_id: userId,
        token_hash: tokenHash,
        device_name: deviceName || null,
        device_type: deviceType || 'web',
        ip_address: ipAddress || null,
        user_agent: userAgent || null,
        expires_at: expiresAt,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as SessionRow;
  }

  async findActiveByTokenHash(tokenHash: string): Promise<SessionRow | null> {
    const row = await this.db.selectFrom('user_sessions').selectAll()
      .where('token_hash', '=', tokenHash)
      .where('is_active', '=', true)
      .where('expires_at', '>', now())
      .executeTakeFirst();
    return (row as SessionRow | undefined) ?? null;
  }

  async findActiveByUser(userId: string): Promise<SessionSummary[]> {
    return this.db.selectFrom('user_sessions')
      .select(['id', 'device_name', 'device_type', 'ip_address', 'user_agent', 'last_activity', 'created_at'])
      .where('user_id', '=', userId)
      .where('is_active', '=', true)
      .where('expires_at', '>', now())
      .orderBy('last_activity', 'desc')
      .execute() as Promise<SessionSummary[]>;
  }

  /**
   * Para la alerta de "inicio de sesión desde un dispositivo nuevo": si el
   * usuario ya tuvo sesiones, y si alguna (de los últimos 90 días) fue con este
   * mismo navegador.
   */
  async deviceHistory(userId: string, userAgent: string | null): Promise<{ hasAny: boolean; known: boolean }> {
    const anySession = await this.db.selectFrom('user_sessions').select('id')
      .where('user_id', '=', userId)
      .limit(1)
      .executeTakeFirst();
    if (!anySession) return { hasAny: false, known: false };
    // `user_agent IS NOT DISTINCT FROM $2`: null también cuenta como coincidencia.
    const sameDevice = await this.db.selectFrom('user_sessions').select('id')
      .where('user_id', '=', userId)
      .where((eb) => (userAgent === null ? eb('user_agent', 'is', null) : eb('user_agent', '=', userAgent)))
      .where('created_at', '>', nowMinus(90, 'days'))
      .limit(1)
      .executeTakeFirst();
    return { hasAny: true, known: !!sameDevice };
  }

  async deactivate(id: string): Promise<void> {
    await this.db.updateTable('user_sessions').set({ is_active: false }).where('id', '=', id).execute();
  }

  async deactivateAllForUser(userId: string, exceptId: string | null = null): Promise<void> {
    let q = this.db.updateTable('user_sessions').set({ is_active: false }).where('user_id', '=', userId);
    if (exceptId) q = q.where('id', '!=', exceptId);
    await q.execute();
  }

  async updateActivity(id: string): Promise<void> {
    await this.db.updateTable('user_sessions').set({ last_activity: now() }).where('id', '=', id).execute();
  }
}

export default new SessionRepository();
