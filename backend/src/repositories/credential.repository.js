const BaseRepository = require('./base.repository');

class CredentialRepository extends BaseRepository {
  constructor() {
    super('user_credentials');
  }

  async findByUserId(userId) {
    const { rows } = await this.query(
      'SELECT * FROM user_credentials WHERE user_id = $1',
      [userId]
    );
    return rows[0] || null;
  }

  async create(userId, passwordHash) {
    const { rows } = await this.query(
      `INSERT INTO user_credentials (user_id, password_hash)
       VALUES ($1, $2) RETURNING *`,
      [userId, passwordHash]
    );
    return rows[0];
  }

  async updatePassword(userId, passwordHash) {
    const { rows } = await this.query(
      `UPDATE user_credentials
       SET password_hash = $1, pw_changed_at = NOW(), must_change_pw = FALSE, failed_attempts = 0
       WHERE user_id = $2 RETURNING *`,
      [passwordHash, userId]
    );
    return rows[0];
  }

  async incrementFailedAttempts(userId) {
    const { rows } = await this.query(
      `UPDATE user_credentials
       SET failed_attempts = failed_attempts + 1,
           locked_until = CASE
             WHEN failed_attempts + 1 >= 5 THEN NOW() + INTERVAL '15 minutes'
             ELSE locked_until
           END
       WHERE user_id = $1 RETURNING *`,
      [userId]
    );
    return rows[0];
  }

  async resetFailedAttempts(userId) {
    await this.query(
      `UPDATE user_credentials SET failed_attempts = 0, locked_until = NULL WHERE user_id = $1`,
      [userId]
    );
  }

  // ── 2FA ──────────────────────────────────────────────────────────────────

  async setTotpSecret(userId, secret) {
    await this.query(
      `UPDATE user_credentials SET totp_secret = $1, totp_enabled = FALSE WHERE user_id = $2`,
      [secret, userId]
    );
  }

  async enableTotp(userId, hashedBackupCodes) {
    await this.query(
      `UPDATE user_credentials
       SET totp_enabled = TRUE, totp_backup_codes = $1
       WHERE user_id = $2`,
      [hashedBackupCodes, userId]
    );
  }

  async disableTotp(userId) {
    await this.query(
      `UPDATE user_credentials
       SET totp_enabled = FALSE, totp_secret = NULL, totp_backup_codes = '{}'
       WHERE user_id = $1`,
      [userId]
    );
  }

  async updateBackupCodes(userId, hashedBackupCodes) {
    await this.query(
      `UPDATE user_credentials SET totp_backup_codes = $1 WHERE user_id = $2`,
      [hashedBackupCodes, userId]
    );
  }

  async removeBackupCode(userId, codeHash) {
    await this.query(
      `UPDATE user_credentials
       SET totp_backup_codes = array_remove(totp_backup_codes, $1)
       WHERE user_id = $2`,
      [codeHash, userId]
    );
  }
}

module.exports = new CredentialRepository();
