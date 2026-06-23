const { pool } = require('../config/database');

class AuditRepository {
  async log({ actor_id, action, resource_type, resource_id, ip_address, user_agent, data_before, data_after, success = true, error_message }) {
    const { rows } = await pool.query(
      `INSERT INTO audit_log (actor_id, action, resource_type, resource_id, ip_address, user_agent, data_before, data_after, success, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [actor_id || null, action, resource_type || null, resource_id || null,
       ip_address || null, user_agent || null, data_before || null, data_after || null,
       success, error_message || null]
    );
    return rows[0];
  }

  async findByActor(actorId, { limit = 50, offset = 0 } = {}) {
    const { rows } = await pool.query(
      `SELECT * FROM audit_log WHERE actor_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [actorId, limit, offset]
    );
    return rows;
  }

  async findByResource(resourceType, resourceId, { limit = 50, offset = 0 } = {}) {
    const { rows } = await pool.query(
      `SELECT * FROM audit_log
       WHERE resource_type = $1 AND resource_id = $2
       ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
      [resourceType, resourceId, limit, offset]
    );
    return rows;
  }

  async search({
    action,
    actor_id,
    resource_type,
    success,
    from,
    to,
    limit = 50,
    offset = 0,
  } = {}) {
    const conditions = ['1=1'];
    const params = [];
    let idx = 1;

    if (action) {
      conditions.push(`a.action ILIKE $${idx}`);
      params.push(`%${action}%`);
      idx++;
    }
    if (actor_id) {
      conditions.push(`a.actor_id = $${idx}`);
      params.push(actor_id);
      idx++;
    }
    if (resource_type) {
      conditions.push(`a.resource_type = $${idx}`);
      params.push(resource_type);
      idx++;
    }
    if (success !== undefined && success !== null && success !== '') {
      conditions.push(`a.success = $${idx}`);
      params.push(success === 'true' || success === true);
      idx++;
    }
    if (from) {
      conditions.push(`a.created_at >= $${idx}`);
      params.push(from);
      idx++;
    }
    if (to) {
      conditions.push(`a.created_at <= $${idx}`);
      params.push(to);
      idx++;
    }

    params.push(limit, offset);
    const { rows } = await pool.query(
      `SELECT a.*, u.display_name AS actor_display_name, u.username AS actor_username
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.actor_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );
    return rows;
  }
}

module.exports = new AuditRepository();
