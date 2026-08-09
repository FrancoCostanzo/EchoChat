import BaseRepository from './base.repository';
import type { Row } from '../types/rows';
import type { UpdateProfileRequest } from '../dtos/auth.dto';

type UserRow = Row<'users'>;

/** Rol tal como se lista en el panel (sin las columnas internas del rol). */
export type RoleSummary = Pick<Row<'roles'>, 'id' | 'name' | 'display_name' | 'description' | 'priority'>;

/** Rol otorgado a un usuario, con los datos de la concesión. */
export type GrantedRole = Pick<Row<'roles'>, 'id' | 'name' | 'display_name'> &
  Pick<Row<'user_roles'>, 'granted_at' | 'expires_at'>;

class UserRepository extends BaseRepository<UserRow> {
  constructor() {
    super('users');
  }

  async findByUsername(username: string): Promise<UserRow | null> {
    const { rows } = await this.query(
      'SELECT * FROM users WHERE username = $1 AND status != $2',
      [username, 'deleted']
    );
    return rows[0] || null;
  }

  async findByEmail(email: string): Promise<UserRow | null> {
    const { rows } = await this.query(
      'SELECT * FROM users WHERE email = $1 AND status != $2',
      [email, 'deleted']
    );
    return rows[0] || null;
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
    const { rows } = await this.query(
      `INSERT INTO users (username, display_name, email, phone_extension, department, job_title, auth_provider, external_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        username, display_name, email || null, phone_extension || null,
        department || null, job_title || null,
        auth_provider || 'local', external_id || null,
      ]
    );
    return rows[0];
  }

  async findByExternalId(externalId: string): Promise<UserRow | null> {
    const { rows } = await this.query(
      'SELECT * FROM users WHERE external_id = $1',
      [externalId]
    );
    return rows[0] || null;
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
      const { rows } = await this.query(
        `UPDATE users
         SET display_name = $2,
             email = $3,
             department = $4,
             job_title = $5,
             status = CASE WHEN status = 'deleted' THEN status ELSE $6 END,
             updated_at = NOW()
         WHERE external_id = $1
         RETURNING *`,
        [external_id, display_name, email || null, department || null, job_title || null, targetStatus]
      );
      const reactivated = existing.status === 'suspended' && targetStatus === 'active';
      return { user: rows[0], created: false, reactivated };
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
      const { rows } = await this.query(
        `UPDATE users
         SET display_name = COALESCE($2, display_name),
             email = COALESCE($3, email),
             updated_at = NOW()
         WHERE external_id = $1
         RETURNING *`,
        [external_id, display_name, email || null]
      );
      return { user: rows[0], created: false };
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
    const { rows } = await this.query(
      `SELECT * FROM users WHERE id = $1 AND auth_provider = 'scim' AND status <> 'deleted'`,
      [id]
    );
    return rows[0] || null;
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
    const cond = [`auth_provider = 'scim'`, `status <> 'deleted'`];
    const params: any[] = [];
    let i = 1;
    if (username) { cond.push(`username = $${i++}`); params.push(username); }
    if (externalId) { cond.push(`external_id = $${i++}`); params.push(`scim:${externalId}`); }
    const where = cond.join(' AND ');
    const totalRes = await this.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM users WHERE ${where}`, params
    );
    const rowsRes = await this.query(
      `SELECT * FROM users WHERE ${where} ORDER BY created_at ASC LIMIT $${i++} OFFSET $${i}`,
      [...params, limit, offset]
    );
    return { rows: rowsRes.rows, total: totalRes.rows[0].c };
  }

  // Deprovisioning: deshabilita a los usuarios LDAP activos cuyo external_id ya no
  // aparece en el directorio. Devuelve los ids afectados para revocar sus sesiones.
  async disableLdapUsersNotIn(seenExternalIds: string[]): Promise<string[]> {
    // Sin ids vistos no deshabilitamos nada: evita un apagón masivo ante un fetch vacío.
    if (!Array.isArray(seenExternalIds) || seenExternalIds.length === 0) return [];
    const { rows } = await this.query<{ id: string }>(
      `UPDATE users
       SET status = 'suspended', updated_at = NOW()
       WHERE auth_provider = 'ldap'
         AND status = 'active'
         AND external_id IS NOT NULL
         AND NOT (external_id = ANY($1::text[]))
       RETURNING id`,
      [seenExternalIds]
    );
    return rows.map((r) => r.id);
  }

  async updateProfile(id: string, fields: UpdateProfileRequest): Promise<UserRow | null> {
    const allowed = ['display_name', 'email', 'phone_extension', 'department', 'job_title',
      'presence', 'presence_message', 'timezone', 'locale'] as const;
    const sets: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const key of allowed) {
      if (fields[key] !== undefined) {
        sets.push(`${key} = $${idx}`);
        values.push(fields[key]);
        idx++;
      }
    }
    if (sets.length === 0) return this.findById(id);

    values.push(id);
    const { rows } = await this.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return rows[0];
  }

  async updateAvatar(id: string, bucket: string, objectKey: string): Promise<UserRow> {
    const { rows } = await this.query(
      `UPDATE users SET avatar_bucket = $1, avatar_object_key = $2 WHERE id = $3 RETURNING *`,
      [bucket, objectKey, id]
    );
    return rows[0];
  }

  async clearAvatar(id: string): Promise<UserRow> {
    const { rows } = await this.query(
      `UPDATE users SET avatar_bucket = NULL, avatar_object_key = NULL WHERE id = $1 RETURNING *`,
      [id]
    );
    return rows[0];
  }

  async updatePresence(id: string, presence: string): Promise<UserRow> {
    const { rows } = await this.query(
      `UPDATE users SET presence = $1, last_seen_at = NOW() WHERE id = $2 RETURNING *`,
      [presence, id]
    );
    return rows[0];
  }

  // Activity heartbeat: keeps the presence timeout job at bay without
  // touching the presence value itself.
  async touchLastSeen(id: string): Promise<void> {
    await this.query(
      `UPDATE users SET last_seen_at = NOW() WHERE id = $1`,
      [id]
    );
  }

  async softDelete(id: string): Promise<UserRow> {
    const { rows } = await this.query(
      `UPDATE users SET status = 'deleted', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    return rows[0];
  }

  // ── RBAC ────────────────────────────────────────────────────────────────
  // Distinct permission codes granted to a user through their (non-expired) roles.
  async getPermissionCodes(userId: string): Promise<string[]> {
    const { rows } = await this.query<{ code: string }>(
      `SELECT DISTINCT p.code
       FROM user_roles ur
       JOIN role_permissions rp ON rp.role_id = ur.role_id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE ur.user_id = $1
         AND (ur.expires_at IS NULL OR ur.expires_at > NOW())`,
      [userId]
    );
    return rows.map((r) => r.code);
  }

  // Role names held by a user (highest priority first), excluding expired grants.
  async getRoleNames(userId: string): Promise<string[]> {
    const { rows } = await this.query<{ name: string }>(
      `SELECT r.name
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1
         AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
       ORDER BY r.priority DESC`,
      [userId]
    );
    return rows.map((r) => r.name);
  }

  // Flip users who have been inactive for `minutes` from 'online' to 'away'.
  // Returns the affected user ids so the caller can broadcast presence changes.
  async markStaleOnlineAsAway(minutes: number): Promise<string[]> {
    const { rows } = await this.query<{ id: string }>(
      `UPDATE users
       SET presence = 'away'
       WHERE presence = 'online'
         AND last_seen_at IS NOT NULL
         AND last_seen_at < NOW() - ($1 * INTERVAL '1 minute')
       RETURNING id`,
      [minutes]
    );
    return rows.map((r) => r.id);
  }

  async hasPermission(userId: string, code: string): Promise<boolean> {
    const { rows } = await this.query(
      `SELECT 1
       FROM user_roles ur
       JOIN role_permissions rp ON rp.role_id = ur.role_id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE ur.user_id = $1
         AND p.code = $2
         AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
       LIMIT 1`,
      [userId, code]
    );
    return rows.length > 0;
  }

  async search(term: string | null | undefined, limit = 20, offset = 0): Promise<UserRow[]> {
    const { rows } = await this.query(
      `SELECT * FROM users
       WHERE status != 'deleted'
         AND (display_name ILIKE $1 OR username ILIKE $1)
       ORDER BY display_name
       LIMIT $2 OFFSET $3`,
      [`%${term ?? ''}%`, limit, offset]
    );
    return rows;
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
    const conditions = [`status != 'deleted'`];
    const params: any[] = [];
    let idx = 1;

    if (search) {
      conditions.push(`(display_name ILIKE $${idx} OR username ILIKE $${idx} OR email ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    if (status) {
      conditions.push(`status = $${idx}`);
      params.push(status);
      idx++;
    }
    if (department) {
      conditions.push(`department ILIKE $${idx}`);
      params.push(`%${department}%`);
      idx++;
    }

    params.push(limit, offset);
    const { rows } = await this.query(
      `SELECT * FROM users WHERE ${conditions.join(' AND ')}
       ORDER BY display_name ASC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );
    return rows;
  }

  async updateStatus(id: string, status: string): Promise<UserRow> {
    const { rows } = await this.query(
      `UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2 AND status != 'deleted' RETURNING *`,
      [status, id]
    );
    return rows[0];
  }

  async listRoles(): Promise<RoleSummary[]> {
    const { rows } = await this.query<RoleSummary>(
      `SELECT id, name, display_name, description, priority FROM roles ORDER BY priority DESC`
    );
    return rows;
  }

  async getUserRoles(userId: string): Promise<GrantedRole[]> {
    const { rows } = await this.query<GrantedRole>(
      `SELECT r.id, r.name, r.display_name, ur.granted_at, ur.expires_at
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1
         AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
       ORDER BY r.priority DESC`,
      [userId]
    );
    return rows;
  }

  async setUserRoles(
    userId: string,
    roleNames: string[] | undefined,
    grantedBy: string | null,
  ): Promise<{ role_id: string }[]> {
    await this.query(`DELETE FROM user_roles WHERE user_id = $1`, [userId]);
    if (!roleNames?.length) return [];
    const { rows } = await this.query<{ role_id: string }>(
      `INSERT INTO user_roles (user_id, role_id, granted_by)
       SELECT $1, r.id, $2 FROM roles r WHERE r.name = ANY($3::text[])
       RETURNING role_id`,
      [userId, grantedBy, roleNames]
    );
    return rows;
  }

  async countUsersWithRole(roleName: string): Promise<number> {
    const { rows } = await this.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE r.name = $1
         AND (ur.expires_at IS NULL OR ur.expires_at > NOW())`,
      [roleName]
    );
    return rows[0]?.count || 0;
  }
}

export = new UserRepository();
