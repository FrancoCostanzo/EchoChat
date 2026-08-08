import BaseRepository from './base.repository';
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
    const { rows } = await this.query(
      `INSERT INTO user_sessions (user_id, token_hash, device_name, device_type, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userId, tokenHash, deviceName || null, deviceType || 'web', ipAddress || null, userAgent || null, expiresAt]
    );
    return rows[0];
  }

  async findActiveByTokenHash(tokenHash: string): Promise<SessionRow | null> {
    const { rows } = await this.query(
      `SELECT * FROM user_sessions
       WHERE token_hash = $1 AND is_active = TRUE AND expires_at > NOW()`,
      [tokenHash]
    );
    return rows[0] || null;
  }

  async findActiveByUser(userId: string): Promise<SessionSummary[]> {
    const { rows } = await this.query<SessionSummary>(
      `SELECT id, device_name, device_type, ip_address, user_agent, last_activity, created_at
       FROM user_sessions
       WHERE user_id = $1 AND is_active = TRUE AND expires_at > NOW()
       ORDER BY last_activity DESC`,
      [userId]
    );
    return rows;
  }

  async deactivate(id: string): Promise<void> {
    await this.query(
      'UPDATE user_sessions SET is_active = FALSE WHERE id = $1',
      [id]
    );
  }

  async deactivateAllForUser(userId: string, exceptId: string | null = null): Promise<void> {
    if (exceptId) {
      await this.query(
        'UPDATE user_sessions SET is_active = FALSE WHERE user_id = $1 AND id != $2',
        [userId, exceptId]
      );
    } else {
      await this.query(
        'UPDATE user_sessions SET is_active = FALSE WHERE user_id = $1',
        [userId]
      );
    }
  }

  async updateActivity(id: string): Promise<void> {
    await this.query(
      'UPDATE user_sessions SET last_activity = NOW() WHERE id = $1',
      [id]
    );
  }
}

export = new SessionRepository();
