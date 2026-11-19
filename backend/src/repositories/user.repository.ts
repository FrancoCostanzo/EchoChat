import { sql, type ExpressionBuilder } from 'kysely';
import BaseRepository from './base.repository';
import { upsert, insertIgnore } from '../config/db/upsert';
import { now, nowMinus, ilike, json } from '../config/db/sql';
import { isMssql, isPostgres } from '../config/db/schema';
import type { DB } from '../types/db';
import type { Row } from '../types/rows';
import type { UpdateProfileRequest } from '../dtos/auth.dto';

type UserRow = Row<'users'>;

/** Rol tal como se lista en el panel (sin las columnas internas del rol). */
export type RoleSummary = Pick<Row<'roles'>, 'id' | 'name' | 'display_name' | 'description' | 'priority'>;

/** Rol otorgado a un usuario, con los datos de la concesión. */
export type GrantedRole = Pick<Row<'roles'>, 'id' | 'name' | 'display_name'> &
  Pick<Row<'user_roles'>, 'granted_at' | 'expires_at'>;

/** Concesión vigente: sin vencimiento o con vencimiento futuro. */
function activeGrant(eb: ExpressionBuilder<DB & { ur: DB['user_roles'] }, 'ur'>) {
  return eb.or([eb('ur.expires_at', 'is', null), eb('ur.expires_at', '>', now())]);
}

/** Lista blanca → sólo las presentes en `fields` (para los UPDATE parciales). */
function pick<K extends string>(fields: Partial<Record<K, unknown>>, allowed: readonly K[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (fields[key] !== undefined) out[key] = fields[key];
  }
  return out;
}

class UserRepository extends BaseRepository<UserRow> {
  constructor() {
    super('users');
  }

  private async one(q: Promise<unknown>): Promise<UserRow | null> {
    return ((await q) as UserRow | undefined) ?? null;
  }

  async findByUsername(username: string): Promise<UserRow | null> {
    return this.one(this.db.selectFrom('users').selectAll()
      .where('username', '=', username).where('status', '!=', 'deleted')
      .executeTakeFirst());
  }

  /** Sin distinguir mayúsculas: para "olvidé mi contraseña", donde el email lo tipea el usuario. */
  async findByEmailInsensitive(email: string): Promise<UserRow | null> {
    return this.one(this.db.selectFrom('users').selectAll()
      .where((eb) => eb(eb.fn('lower', ['email']), '=', eb.fn('lower', [eb.val(email)])))
      .where('status', '!=', 'deleted')
      .limit(1)
      .executeTakeFirst());
  }

  async findByEmail(email: string): Promise<UserRow | null> {
    return this.one(this.db.selectFrom('users').selectAll()
      .where('email', '=', email).where('status', '!=', 'deleted')
      .executeTakeFirst());
  }

  async create(
    { username, display_name, email, phone_extension, department, job_title, auth_provider, external_id }: {
      username: string;
      display_name: string;
      email?: string | null;
      phone_extension?: string | null;
      department?: string | null;
      job_title?: string | null;
      auth_provider?: string | null;
      external_id?: string | null;
    },
  ): Promise<UserRow> {
    const row = await this.db.insertInto('users')
      .values({
        username,
        display_name,
        email: email || null,
        phone_extension: phone_extension || null,
        department: department || null,
        job_title: job_title || null,
        auth_provider: auth_provider || 'local',
        external_id: external_id || null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as UserRow;
  }

  async findByExternalId(externalId: string): Promise<UserRow | null> {
    return this.one(this.db.selectFrom('users').selectAll().where('external_id', '=', externalId).executeTakeFirst());
  }

  // Inserta o actualiza un usuario LDAP identificado por external_id.
  // `is_disabled` refleja el estado en el directorio (AD): sincroniza status
  // active/suspended, pero nunca reactiva una cuenta borrada localmente.
  // Devuelve { user, created, reactivated } para que el caller pueda contar/auditar.
  async upsertLdapUser(
    { external_id, username, display_name, email, department, job_title, is_disabled = false }: {
      external_id: string;
      username: string;
      display_name: string;
      email?: string | null;
      department?: string | null;
      job_title?: string | null;
      is_disabled?: boolean;
    },
  ): Promise<{ user: UserRow; created: boolean; reactivated: boolean }> {
    const targetStatus = is_disabled ? 'suspended' : 'active';
    const existing = await this.findByExternalId(external_id);
    if (existing) {
      const row = await this.db.updateTable('users')
        .set((eb) => ({
          display_name,
          email: email || null,
          department: department || null,
          job_title: job_title || null,
          status: eb.case().when('status', '=', 'deleted').then(eb.ref('status')).else(targetStatus).end(),
          updated_at: now(),
        }))
        .where('external_id', '=', external_id)
        .returningAll()
        .executeTakeFirst();
      const reactivated = existing.status === 'suspended' && targetStatus === 'active';
      return { user: row as UserRow, created: false, reactivated };
    }
    const user = await this.create({
      username, display_name, email, department, job_title,
      auth_provider: 'ldap', external_id,
    });
    if (is_disabled) await this.updateStatus(user.id, 'suspended');
    return { user, created: true, reactivated: false };
  }

  // Genera un username libre a partir de `base`, agregando sufijo numérico si ya
  // existe (los usuarios SSO nuevos podrían chocar con un username local existente).
  async _uniqueUsername(base: string | null | undefined): Promise<string> {
    const seed = base || 'user';
    let candidate = seed;
    let n = 1;
    // Límite defensivo para no iterar indefinidamente ante datos corruptos.
    while (n < 1000 && (await this.findByUsername(candidate))) {
      candidate = `${seed}.${n}`;
      n += 1;
    }
    return candidate;
  }

  // Inserta o actualiza un usuario OIDC identificado por external_id (oidc:<prov>:<sub>).
  // Devuelve { user, created } al estilo de upsertLdapUser.
  async upsertOidcUser(
    { external_id, username, display_name, email }: {
      external_id: string;
      username: string;
      display_name: string;
      email?: string | null;
    },
  ): Promise<{ user: UserRow; created: boolean }> {
    const existing = await this.findByExternalId(external_id);
    if (existing) {
      // No tocamos `status`: si un admin deshabilitó al usuario, debe seguir bloqueado
      // aunque el IdP lo siga autenticando. El guard de estado vive en el login.
      const row = await this.db.updateTable('users')
        .set((eb) => ({
          display_name: eb.fn.coalesce(eb.val(display_name), eb.ref('display_name')),
          email: eb.fn.coalesce(eb.val(email || null), eb.ref('email')),
          updated_at: now(),
        }))
        .where('external_id', '=', external_id)
        .returningAll()
        .executeTakeFirst();
      return { user: row as UserRow, created: false };
    }
    const finalUsername = await this._uniqueUsername(username);
    const user = await this.create({
      username: finalUsername, display_name, email,
      auth_provider: 'oidc', external_id,
    });
    return { user, created: true };
  }

  // ── SCIM ──────────────────────────────────────────────────────────────────
  // Usuario gestionado por SCIM (excluye borrados). Los suspendidos sí se devuelven:
  // desaprovisionar es active=false, no un delete.
  async findScimById(id: string): Promise<UserRow | null> {
    return this.one(this.db.selectFrom('users').selectAll()
      .where('id', '=', id).where('auth_provider', '=', 'scim').where('status', '<>', 'deleted')
      .executeTakeFirst());
  }

  // Lista usuarios SCIM con filtro opcional por userName / externalId y paginación.
  // Devuelve { rows, total } para armar la ListResponse.
  async listScimUsers(
    { username, externalId, limit, offset }: {
      username?: string;
      externalId?: string;
      limit: number;
      offset: number;
    },
  ): Promise<{ rows: UserRow[]; total: number }> {
    let q = this.db.selectFrom('users').where('auth_provider', '=', 'scim').where('status', '<>', 'deleted');
    if (username) q = q.where('username', '=', username);
    if (externalId) q = q.where('external_id', '=', `scim:${externalId}`);
    const { c } = await q.select((eb) => eb.cast<number>(eb.fn.countAll(), 'integer').as('c')).executeTakeFirstOrThrow();
    const rows = await q.selectAll().orderBy('created_at', 'asc').limit(limit).offset(offset).execute();
    return { rows: rows as UserRow[], total: c };
  }

  // Deprovisioning: deshabilita a los usuarios LDAP activos cuyo external_id ya no
  // aparece en el directorio. Devuelve los ids afectados para revocar sus sesiones.
  async disableLdapUsersNotIn(seenExternalIds: string[]): Promise<string[]> {
    // Sin ids vistos no deshabilitamos nada: evita un apagón masivo ante un fetch vacío.
    if (!Array.isArray(seenExternalIds) || seenExternalIds.length === 0) return [];
    const rows = await this.db.updateTable('users')
      .set({ status: 'suspended', updated_at: now() })
      .where('auth_provider', '=', 'ldap')
      .where('status', '=', 'active')
      .where('external_id', 'is not', null)
      // Un solo parámetro array a propósito: el directorio puede tener miles de
      // ids y un `NOT IN (...)` armaría un parámetro por cada uno.
      // (SQL Server además tiene un tope de 2100 parámetros por consulta).
      .where(isMssql()
        ? sql<boolean>`external_id NOT IN (SELECT [value] FROM OPENJSON(${json(seenExternalIds)}))`
        : sql<boolean>`NOT (external_id = ANY(${seenExternalIds}::text[]))`)
      .returning('id')
      .execute();
    return rows.map((r) => r.id);
  }

  async updateProfile(id: string, fields: UpdateProfileRequest): Promise<UserRow | null> {
    const changes = pick(fields, ['display_name', 'email', 'phone_extension', 'department', 'job_title',
      'presence', 'presence_message', 'timezone', 'locale'] as const);
    if (Object.keys(changes).length === 0) return this.findById(id);
    const row = await this.db.updateTable('users').set(changes).where('id', '=', id).returningAll().executeTakeFirst();
    return row as UserRow;
  }

  // ── Estado de ausencia ──────────────────────────────────────────────────
  /**
   * Activa la ausencia. La presencia pasa a `away` acá mismo: es una elección
   * manual, así que el heartbeat de actividad no la va a pisar (sólo revierte
   * las ausencias que puso el job).
   */
  async setAwayState(
    id: string,
    { message, until, autoReply }: { message: string; until?: Date | string | null; autoReply: boolean },
  ): Promise<UserRow | undefined> {
    const row = await this.db.updateTable('users')
      .set({ presence: 'away', presence_message: message, away_until: until || null, auto_reply_enabled: autoReply })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    return row as UserRow | undefined;
  }

  /** Vuelve de la ausencia. `presence` sólo se toca si seguía en `away`. */
  async clearAwayState(id: string): Promise<UserRow | undefined> {
    const row = await this.db.updateTable('users')
      .set((eb) => ({
        presence: eb.case().when('presence', '=', 'away').then('online').else(eb.ref('presence')).end(),
        presence_message: null,
        away_until: null,
        auto_reply_enabled: false,
      }))
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    return row as UserRow | undefined;
  }

  /** Ausencias vencidas, para que el job las levante y las limpie. */
  async findExpiredAway(limit = 200): Promise<UserRow[]> {
    return this.db.selectFrom('users').selectAll()
      .where('away_until', 'is not', null)
      .where('away_until', '<=', now())
      .limit(limit)
      .execute() as Promise<UserRow[]>;
  }

  /**
   * Reserva el derecho a mandar una auto-respuesta de `awayUserId` a
   * `peerUserId`: devuelve true sólo si pasaron más de `horas` desde la última.
   *
   * El chequeo y la marca van en la misma sentencia a propósito — con dos
   * mensajes entrando a la vez, un SELECT + INSERT separados dejarían pasar dos
   * auto-respuestas.
   */
  async reservarAutoRespuesta(awayUserId: string, peerUserId: string, horas: number): Promise<boolean> {
    const row = await upsert(this.db, { table: 'auto_reply_log', values: { away_user_id: awayUserId, peer_user_id: peerUserId, last_sent_at: now() }, conflict: ['away_user_id', 'peer_user_id'], update: { last_sent_at: now() }, updateWhere: (eb) => eb('auto_reply_log.last_sent_at', '<', nowMinus(horas, 'hours')), returning: true });
    return !!row;
  }

  async updateAvatar(id: string, bucket: string, objectKey: string): Promise<UserRow> {
    const row = await this.db.updateTable('users')
      .set({ avatar_bucket: bucket, avatar_object_key: objectKey })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    return row as UserRow;
  }

  async clearAvatar(id: string): Promise<UserRow> {
    const row = await this.db.updateTable('users')
      .set({ avatar_bucket: null, avatar_object_key: null })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    return row as UserRow;
  }

  async updatePresence(id: string, presence: string): Promise<UserRow> {
    const row = await this.db.updateTable('users')
      .set({ presence, last_seen_at: now() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    return row as UserRow;
  }

  // Activity heartbeat: keeps the presence timeout job at bay without
  // touching the presence value itself.
  async touchLastSeen(id: string): Promise<void> {
    await this.db.updateTable('users').set({ last_seen_at: now() }).where('id', '=', id).execute();
  }

  async softDelete(id: string): Promise<UserRow> {
    const row = await this.db.updateTable('users')
      .set({ status: 'deleted', updated_at: now() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    return row as UserRow;
  }

  // ── RBAC ────────────────────────────────────────────────────────────────
  // Distinct permission codes granted to a user through their (non-expired) roles.
  async getPermissionCodes(userId: string): Promise<string[]> {
    const rows = await this.db.selectFrom('user_roles as ur')
      .innerJoin('role_permissions as rp', 'rp.role_id', 'ur.role_id')
      .innerJoin('permissions as p', 'p.id', 'rp.permission_id')
      .select('p.code')
      .distinct()
      .where('ur.user_id', '=', userId)
      .where(activeGrant)
      .execute();
    return rows.map((r) => r.code);
  }

  // Role names held by a user (highest priority first), excluding expired grants.
  async getRoleNames(userId: string): Promise<string[]> {
    const rows = await this.db.selectFrom('user_roles as ur')
      .innerJoin('roles as r', 'r.id', 'ur.role_id')
      .select('r.name')
      .where('ur.user_id', '=', userId)
      .where(activeGrant)
      .orderBy('r.priority', 'desc')
      .execute();
    return rows.map((r) => r.name);
  }

  // Flip users who have been inactive for `minutes` from 'online' to 'away'.
  // Returns the affected user ids so the caller can broadcast presence changes.
  async markStaleOnlineAsAway(minutes: number): Promise<string[]> {
    const rows = await this.db.updateTable('users')
      .set({ presence: 'away' })
      .where('presence', '=', 'online')
      .where('last_seen_at', 'is not', null)
      .where('last_seen_at', '<', nowMinus(minutes, 'minutes'))
      .returning('id')
      .execute();
    return rows.map((r) => r.id);
  }

  async hasPermission(userId: string, code: string): Promise<boolean> {
    const row = await this.db.selectFrom('user_roles as ur')
      .innerJoin('role_permissions as rp', 'rp.role_id', 'ur.role_id')
      .innerJoin('permissions as p', 'p.id', 'rp.permission_id')
      .select('p.id')
      .where('ur.user_id', '=', userId)
      .where('p.code', '=', code)
      .where(activeGrant)
      .limit(1)
      .executeTakeFirst();
    return !!row;
  }

  async search(term: string | null | undefined, limit = 20, offset = 0): Promise<UserRow[]> {
    const pattern = `%${term ?? ''}%`;
    return this.db.selectFrom('users').selectAll()
      .where('status', '!=', 'deleted')
      .where((eb) => eb.or([ilike('display_name', pattern), ilike('username', pattern)]))
      .orderBy('display_name')
      .limit(limit).offset(offset)
      .execute() as Promise<UserRow[]>;
  }

  async listUsers(
    { search, status, department, limit = 50, offset = 0 }: {
      search?: string;
      status?: string;
      department?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<UserRow[]> {
    let q = this.db.selectFrom('users').selectAll().where('status', '!=', 'deleted');
    if (search) {
      const pattern = `%${search}%`;
      q = q.where((eb) => eb.or([ilike('display_name', pattern), ilike('username', pattern), ilike('email', pattern)]));
    }
    if (status) q = q.where('status', '=', status);
    if (department) q = q.where(ilike('department', `%${department}%`));
    return q.orderBy('display_name', 'asc').limit(limit).offset(offset).execute() as Promise<UserRow[]>;
  }

  async updateStatus(id: string, status: string): Promise<UserRow> {
    const row = await this.db.updateTable('users')
      .set({ status, updated_at: now() })
      .where('id', '=', id)
      .where('status', '!=', 'deleted')
      .returningAll()
      .executeTakeFirst();
    return row as UserRow;
  }

  async listRoles(): Promise<RoleSummary[]> {
    return this.db.selectFrom('roles')
      .select(['id', 'name', 'display_name', 'description', 'priority'])
      .orderBy('priority', 'desc')
      .execute() as Promise<RoleSummary[]>;
  }

  async getUserRoles(userId: string): Promise<GrantedRole[]> {
    return this.db.selectFrom('user_roles as ur')
      .innerJoin('roles as r', 'r.id', 'ur.role_id')
      .select(['r.id', 'r.name', 'r.display_name', 'ur.granted_at', 'ur.expires_at'])
      .where('ur.user_id', '=', userId)
      .where(activeGrant)
      .orderBy('r.priority', 'desc')
      .execute() as Promise<GrantedRole[]>;
  }

  async setUserRoles(
    userId: string,
    roleNames: string[] | undefined,
    grantedBy: string | null,
  ): Promise<{ role_id: string }[]> {
    await this.db.deleteFrom('user_roles').where('user_id', '=', userId).execute();
    if (!roleNames?.length) return [];
    return this.db.insertInto('user_roles')
      .columns(['user_id', 'role_id', 'granted_by'])
      .expression((eb) => eb.selectFrom('roles as r')
        .select([eb.val(userId).as('user_id'), 'r.id', eb.val(grantedBy).as('granted_by')])
        .where('r.name', 'in', roleNames))
      .returning('role_id')
      .execute();
  }

  /** Le da el rol `user` si todavía no lo tiene (idempotente). */
  async assignDefaultRole(userId: string): Promise<void> {
    await this.db.insertInto('user_roles')
      .columns(['user_id', 'role_id'])
      .expression((eb) => eb.selectFrom('roles as r')
        .select([eb.val(userId).as('user_id'), 'r.id'])
        .where('r.name', '=', 'user')
        .where(({ not, exists, selectFrom }) => not(exists(selectFrom('user_roles as ur').select('ur.user_id')
          .where('ur.user_id', '=', userId).whereRef('ur.role_id', '=', 'r.id')))))
      .$if(isPostgres(), (q) => q.onConflict((oc) => oc.doNothing()))
      .execute();
  }

  async countUsersWithRole(roleName: string): Promise<number> {
    const row = await this.db.selectFrom('user_roles as ur')
      .innerJoin('roles as r', 'r.id', 'ur.role_id')
      .select((eb) => eb.cast<number>(eb.fn.countAll(), 'integer').as('count'))
      .where('r.name', '=', roleName)
      .where(activeGrant)
      .executeTakeFirst();
    return row?.count || 0;
  }
}

export default new UserRepository();
