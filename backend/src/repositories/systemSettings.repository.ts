import BaseRepository from './base.repository';
import { now, json } from '../config/db/sql';
import type { Row } from '../types/rows';

type SettingRow = Row<'system_settings'>;

class SystemSettingsRepository extends BaseRepository<SettingRow> {
  constructor() {
    super('system_settings');
  }

  async findAll(): Promise<SettingRow[]> {
    return this.db.selectFrom('system_settings').selectAll()
      .orderBy('category').orderBy('key')
      .execute() as Promise<SettingRow[]>;
  }

  async findByKey(key: string): Promise<SettingRow | null> {
    const row = await this.db.selectFrom('system_settings').selectAll()
      .where('key', '=', key)
      .executeTakeFirst();
    return (row as SettingRow | undefined) ?? null;
  }

  async update(key: string, value: unknown, updatedBy: string | null): Promise<SettingRow> {
    const row = await this.db.updateTable('system_settings')
      .set({ value: json(value), updated_by: updatedBy, updated_at: now() })
      .where('key', '=', key)
      .returningAll()
      .executeTakeFirst();
    return row as SettingRow;
  }
}

export default new SystemSettingsRepository();
