import { sql } from 'kysely';
import BaseRepository from './base.repository';
import { now, nowMinus } from '../config/db/sql';
import type { Row } from '../types/rows';
import type { CallHistoryRow } from '../models/call.model';
import type { UpdateParticipantRequest } from '../dtos/call.dto';

type CallRow = Row<'calls'>;
type ParticipantRow = Row<'call_participants'>;

/** Participante con los datos del usuario que trae el JOIN. */
export type ParticipantWithUser = ParticipantRow & {
  username: string;
  display_name: string;
  avatar_object_key: string | null;
};

class CallRepository extends BaseRepository<CallRow> {
  constructor() {
    super('calls');
  }

  async create(
    { conversation_id, type, initiated_by }: {
      conversation_id?: string | null;
      type: string;
      initiated_by: string;
    },
  ): Promise<CallRow> {
    const row = await this.db.insertInto('calls')
      .values({ conversation_id: conversation_id || null, type, initiated_by })
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as CallRow;
  }

  async updateStatus(id: string, status: string, endReason: string | null = null): Promise<CallRow> {
    const changes: Record<string, unknown> = { status };
    if (status === 'active') changes.answered_at = now();
    if (status === 'ended' || status === 'missed' || status === 'rejected' || status === 'failed') {
      changes.ended_at = now();
      changes.end_reason = endReason;
    }
    const row = await this.db.updateTable('calls')
      .set(changes)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    return row as CallRow;
  }

  async addParticipant(callId: string, userId: string): Promise<ParticipantRow | undefined> {
    const row = await this.db.insertInto('call_participants')
      .values({ call_id: callId, user_id: userId })
      .onConflict((oc) => oc.columns(['call_id', 'user_id']).doNothing())
      .returningAll()
      .executeTakeFirst();
    return row as ParticipantRow | undefined;
  }

  async updateParticipant(
    callId: string,
    userId: string,
    fields: UpdateParticipantRequest,
  ): Promise<ParticipantRow | null | undefined> {
    const allowed = ['status', 'can_speak', 'can_video', 'can_share_screen', 'is_muted_by_host'] as const;
    const changes: Record<string, unknown> = {};
    for (const key of allowed) {
      if (fields[key] !== undefined) changes[key] = fields[key];
    }
    // Update timestamp columns based on status
    if (fields.status === 'joined') changes.joined_at = now();
    if (['left', 'rejected', 'no_answer', 'busy'].includes(fields.status as string)) changes.left_at = now();

    if (Object.keys(changes).length === 0) return null;

    const row = await this.db.updateTable('call_participants')
      .set(changes)
      .where('call_id', '=', callId)
      .where('user_id', '=', userId)
      .returningAll()
      .executeTakeFirst();
    return row as ParticipantRow | undefined;
  }

  /**
   * Calidad medida por un participante al colgar. Queda en su fila y se
   * recalcula el resumen de la llamada (`calls.quality_stats`).
   */
  async recordQuality(
    callId: string,
    userId: string,
    { rttMs, jitterMs, packetLossPct }: { rttMs: number | null; jitterMs: number | null; packetLossPct: number | null },
  ): Promise<void> {
    await this.db.updateTable('call_participants')
      .set({ avg_latency_ms: rttMs === null ? null : Math.round(rttMs), avg_packet_loss: packetLossPct })
      .where('call_id', '=', callId)
      .where('user_id', '=', userId)
      .execute();
    // TODO(etapa 3): operadores JSONB de PostgreSQL; se reescribe leyendo y
    // armando el JSON en la app.
    const jitter = jitterMs === null ? null : Math.round(jitterMs);
    await sql`
      UPDATE calls c SET quality_stats = COALESCE(c.quality_stats, '{}'::jsonb) || jsonb_build_object(
        'avg_rtt_ms', (SELECT ROUND(AVG(avg_latency_ms)) FROM call_participants WHERE call_id = c.id),
        'avg_packet_loss_pct', (SELECT ROUND(AVG(avg_packet_loss), 2) FROM call_participants WHERE call_id = c.id),
        'max_jitter_ms', GREATEST(COALESCE((c.quality_stats->>'max_jitter_ms')::numeric, 0), COALESCE(${jitter}::numeric, 0))
      )
      WHERE c.id = ${callId}`.execute(this.db);
  }

  /** Llamadas que todavía le están sonando a `userId` (no atendió ni rechazó). */
  async findRingingForUser(userId: string, maxAgeSeconds: number): Promise<CallRow[]> {
    return this.db.selectFrom('calls as c')
      .innerJoin('call_participants as cp', 'cp.call_id', 'c.id')
      .selectAll('c')
      .where('cp.user_id', '=', userId)
      .where('cp.status', '=', 'invited')
      .where('c.initiated_by', '<>', userId)
      .where('c.status', 'in', ['pending', 'ringing'])
      .where('c.initiated_at', '>', nowMinus(maxAgeSeconds, 'seconds'))
      .execute() as Promise<CallRow[]>;
  }

  async getParticipantIds(callId: string): Promise<string[]> {
    const rows = await this.db.selectFrom('call_participants').select('user_id').where('call_id', '=', callId).execute();
    return rows.map((r) => r.user_id);
  }

  async getParticipants(callId: string): Promise<ParticipantWithUser[]> {
    return this.db.selectFrom('call_participants as cp')
      .innerJoin('users as u', 'u.id', 'cp.user_id')
      .selectAll('cp')
      .select(['u.username', 'u.display_name', 'u.avatar_object_key'])
      .where('cp.call_id', '=', callId)
      .orderBy('cp.invited_at')
      .execute() as unknown as Promise<ParticipantWithUser[]>;
  }

  async findByConversation(
    conversationId: string,
    { limit = 20, offset = 0 }: { limit?: number; offset?: number } = {},
  ): Promise<CallRow[]> {
    return this.db.selectFrom('calls').selectAll()
      .where('conversation_id', '=', conversationId)
      .orderBy('initiated_at', 'desc')
      .limit(limit).offset(offset)
      .execute() as Promise<CallRow[]>;
  }

  // Historial global de un usuario: todas las llamadas en las que participó,
  // a través de cualquier conversación, con el nombre a mostrar resuelto.
  async findByUser(
    userId: string,
    { limit = 50, offset = 0, filter }: { limit?: number; offset?: number; filter?: string } = {},
  ): Promise<CallHistoryRow[]> {
    let q = this.db.selectFrom('calls as c')
      .innerJoin('call_participants as cp', (j) => j.onRef('cp.call_id', '=', 'c.id').on('cp.user_id', '=', userId))
      .leftJoin('conversations as conv', 'conv.id', 'c.conversation_id')
      .leftJoinLateral(
        (eb) => eb.selectFrom('conversation_members as cm2')
          .innerJoin('users as u', 'u.id', 'cm2.user_id')
          .select(['u.display_name', 'u.avatar_object_key'])
          .whereRef('cm2.conversation_id', '=', 'conv.id')
          .where('cm2.user_id', '<>', userId)
          .limit(1)
          .as('other'),
        (j) => j.on('conv.type', '=', 'direct'),
      )
      .selectAll('c')
      .select([
        'conv.type as conversation_type',
        'conv.name as conversation_name',
        'other.display_name as other_display_name',
        'other.avatar_object_key as other_avatar_key',
      ])
      .where('cp.user_id', '=', userId);
    if (filter === 'missed') q = q.where('c.status', 'in', ['missed', 'rejected', 'failed']);
    return q.orderBy('c.initiated_at', 'desc')
      .limit(limit).offset(offset)
      .execute() as unknown as Promise<CallHistoryRow[]>;
  }

  async findActiveByUser(userId: string): Promise<CallRow[]> {
    return this.db.selectFrom('calls as c')
      .innerJoin('call_participants as cp', 'cp.call_id', 'c.id')
      .selectAll('c')
      .where('cp.user_id', '=', userId)
      .where('c.status', 'in', ['pending', 'ringing', 'active'])
      .orderBy('c.initiated_at', 'desc')
      .execute() as Promise<CallRow[]>;
  }
}

export default new CallRepository();
