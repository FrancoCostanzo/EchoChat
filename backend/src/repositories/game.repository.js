const BaseRepository = require('./base.repository');

// In-chat mini-games (tic-tac-toe, rock-paper-scissors, hangman), one row per
// game linked 1:1 to a message like polls.
class GameRepository extends BaseRepository {
  constructor() {
    super('games');
  }

  async createGame({ message_id, conversation_id, kind, player1_id, player2_id, state }) {
    const { rows } = await this.query(
      `INSERT INTO games (message_id, conversation_id, kind, player1_id, player2_id, state)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [message_id, conversation_id, kind, player1_id, player2_id, state]
    );
    return rows[0];
  }

  async findByMessageId(messageId) {
    const { rows } = await this.query(`SELECT * FROM games WHERE message_id = $1`, [messageId]);
    return rows[0] || null;
  }

  async updateState(id, state, status, winnerId, result) {
    const { rows } = await this.query(
      `UPDATE games SET state = $2, status = $3, winner_id = $4, result = $5, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, state, status, winnerId || null, result || null]
    );
    return rows[0];
  }
}

module.exports = new GameRepository();
