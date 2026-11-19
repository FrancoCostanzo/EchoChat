import BaseRepository from './base.repository';
import { now, nowPlus, json } from '../config/db/sql';
import type { Row } from '../types/rows';

type CredentialRow = Row<'user_credentials'>;

class CredentialRepository extends BaseRepository<CredentialRow> {
  constructor() {
    super('user_credentials');
  }

  async findByUserId(userId: string): Promise<CredentialRow | null> {
    const row = await this.db.selectFrom('user_credentials').selectAll().where('user_id', '=', userId).executeTakeFirst();
    return (row as CredentialRow | undefined) ?? null;
  }

  async create(userId: string, passwordHash: string): Promise<CredentialRow> {
    const row = await this.db.insertInto('user_credentials')
      .values({ user_id: userId, password_hash: passwordHash })
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as CredentialRow;
  }

  async updatePassword(userId: string, passwordHash: string): Promise<CredentialRow> {
    const row = await this.db.updateTable('user_credentials')
      .set({ password_hash: passwordHash, pw_changed_at: now(), must_change_pw: false, failed_attempts: 0 })
      .where('user_id', '=', userId)
      .returningAll()
      .executeTakeFirst();
    return row as CredentialRow;
  }

  async incrementFailedAttempts(userId: string): Promise<CredentialRow> {
    const row = await this.db.updateTable('user_credentials')
      .set((eb) => ({
        failed_attempts: eb('failed_attempts', '+', 1),
        locked_until: eb.case()
          .when(eb('failed_attempts', '+', 1), '>=', 5).then(nowPlus(15, 'minutes'))
          .else(eb.ref('locked_until'))
          .end(),
      }))
      .where('user_id', '=', userId)
      .returningAll()
      .executeTakeFirst();
    return row as CredentialRow;
  }

  async resetFailedAttempts(userId: string): Promise<void> {
    await this.db.updateTable('user_credentials')
      .set({ failed_attempts: 0, locked_until: null })
      .where('user_id', '=', userId)
      .execute();
  }

  // ── 2FA ──────────────────────────────────────────────────────────────────
  // totp_backup_codes es un array JSON de hashes (antes TEXT[], ver migración 003).

  async setTotpSecret(userId: string, secret: string): Promise<void> {
    await this.db.updateTable('user_credentials')
      .set({ totp_secret: secret, totp_enabled: false })
      .where('user_id', '=', userId)
      .execute();
  }

  async enableTotp(userId: string, hashedBackupCodes: string[]): Promise<void> {
    await this.db.updateTable('user_credentials')
      .set({ totp_enabled: true, totp_backup_codes: json(hashedBackupCodes) })
      .where('user_id', '=', userId)
      .execute();
  }

  async disableTotp(userId: string): Promise<void> {
    await this.db.updateTable('user_credentials')
      .set({ totp_enabled: false, totp_secret: null, totp_backup_codes: json([]) })
      .where('user_id', '=', userId)
      .execute();
  }

  async updateBackupCodes(userId: string, hashedBackupCodes: string[]): Promise<void> {
    await this.db.updateTable('user_credentials')
      .set({ totp_backup_codes: json(hashedBackupCodes) })
      .where('user_id', '=', userId)
      .execute();
  }

  async removeBackupCode(userId: string, codeHash: string): Promise<void> {
    // Se filtra en la app (antes array_remove de PostgreSQL). El WHERE con la
    // lista leída evita pisar un cambio que haya entrado entre medio.
    const row = await this.db.selectFrom('user_credentials').select('totp_backup_codes')
      .where('user_id', '=', userId)
      .executeTakeFirst();
    const current = (row?.totp_backup_codes ?? []) as string[];
    if (!current.includes(codeHash)) return;
    await this.db.updateTable('user_credentials')
      .set({ totp_backup_codes: json(current.filter((c) => c !== codeHash)) })
      .where('user_id', '=', userId)
      .where('totp_backup_codes', '=', json(current))
      .execute();
  }
}

export default new CredentialRepository();
