// @ts-check
const { pool } = require('../config/database');

/**
 * Repositorio base del que heredan los 22 repositorios del backend.
 *
 * Los tipos de fila todavía no existen (se generan desde el schema en la fase 2
 * de docs/TYPESCRIPT_MIGRATION.md), pero declarar la forma de lo que devuelve
 * `query()` ya alcanza para que TypeScript deje de inferir arrays donde hay
 * objetos y viceversa en toda la capa de servicios.
 *
 * @template [T=any]
 */
class BaseRepository {
  /** @param {string} tableName */
  constructor(tableName) {
    this.tableName = tableName;
    this.pool = pool;
  }

  /**
   * @template [R=T]
   * @param {string} text
   * @param {any[]} [params]
   * @returns {Promise<import('pg').QueryResult<R>>}
   */
  async query(text, params) {
    return this.pool.query(text, params);
  }

  /**
   * @param {string} id
   * @returns {Promise<T | null>}
   */
  async findById(id) {
    const { rows } = await this.query(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  async deleteById(id) {
    const { rowCount } = await this.query(
      `DELETE FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return rowCount > 0;
  }

  async exists(id) {
    const { rows } = await this.query(
      `SELECT 1 FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return rows.length > 0;
  }
}

module.exports = BaseRepository;
