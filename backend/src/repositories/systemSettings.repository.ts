import BaseRepository from './base.repository';
import type { Row } from '../types/rows';

type SettingRow = Row<'system_settings'>;

class SystemSettingsRepository extends BaseRepository<SettingRow> {
  constructor() {
    super('system_settings');
  }

  async findAll(): Promise<SettingRow[]> {
    const { rows } = await this.query(
      `SELECT * FROM system_settings ORDER BY category, key`
    );
    return rows;
  }

  async findByKey(key: string): Promise<SettingRow | null> {
    const { rows } = await this.query(
      `SELECT * FROM system_settings WHERE key = $1`,
      [key]
    );
    return rows[0] || null;
  }

  async update(key: string, value: unknown, updatedBy: string | null): Promise<SettingRow> {
    const { rows } = await this.query(
      `UPDATE system_settings
       SET value = $2::jsonb, updated_by = $3, updated_at = NOW()
       WHERE key = $1 RETURNING *`,
      [key, JSON.stringify(value), updatedBy]
    );
    return rows[0];
  }
}

export = new SystemSettingsRepository();
