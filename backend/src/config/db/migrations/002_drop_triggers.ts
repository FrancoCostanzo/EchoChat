// Los 7 triggers y sus 4 funciones PL/pgSQL pasan al código de la app, para que
// se comporten igual en cualquier motor (docs/MULTI_DB.md, etapa 3):
//   - fn_set_updated_at                  → UpdatedAtPlugin (config/db/updatedAtPlugin.ts)
//   - fn_calculate_call_duration         → call.repository.updateStatus
//   - fn_update_channel_member_count     → conversation.repository add/removeMember
//   - fn_update_conversation_last_message → message.repository.create
import { sql, type Kysely } from 'kysely';
import { onPostgres } from '../schema';

const TRIGGERS: [trigger: string, table: string][] = [
  ['trg_users_updated_at', 'users'],
  ['trg_conversations_updated_at', 'conversations'],
  ['trg_channel_settings_updated_at', 'channel_settings'],
  ['trg_broadcast_lists_updated_at', 'broadcast_lists'],
  ['trg_call_duration', 'calls'],
  ['trg_channel_member_count', 'conversation_members'],
  ['trg_message_update_conversation', 'messages'],
];

const FUNCTIONS = [
  'fn_set_updated_at',
  'fn_calculate_call_duration',
  'fn_update_channel_member_count',
  'fn_update_conversation_last_message',
];

export async function up(db: Kysely<any>): Promise<void> {
  await onPostgres(db, async (db) => {
    for (const [trigger, table] of TRIGGERS) {
      await sql.raw(`DROP TRIGGER IF EXISTS ${trigger} ON ${table}`).execute(db);
    }
    for (const fn of FUNCTIONS) {
      await sql.raw(`DROP FUNCTION IF EXISTS ${fn}()`).execute(db);
    }
  });
}
