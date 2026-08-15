import BaseRepository from './base.repository';
import type { Row } from '../types/rows';
import type { GameState } from '../models/game.model';

type GameRow = Row<'games'>;

// In-chat mini-games (tic-tac-toe, rock-paper-scissors, hangman), one row per
// game linked 1:1 to a message like polls.
class GameRepository extends BaseRepository<GameRow> {
  constructor() {
    super('games');
  }

  async createGame(
    { message_id, conversation_id, kind, player1_id, player2_id, state }: {
      message_id: string;
      conversation_id: string;
      kind: string;
      player1_id: string;
      player2_id: string;
      state: GameState;
    },
  ): Promise<GameRow> {
    const { rows } = await this.query(
      `INSERT INTO games (message_id, conversation_id, kind, player1_id, player2_id, state)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [message_id, conversation_id, kind, player1_id, player2_id, state]
    );
    return rows[0];
  }

  async findByMessageId(messageId: string): Promise<GameRow | null> {
    const { rows } = await this.query(`SELECT * FROM games WHERE message_id = $1`, [messageId]);
    return rows[0] || null;
  }

  async updateState(
    id: string,
    state: GameState,
    status: string,
    winnerId?: string | null,
    result?: string | null,
  ): Promise<GameRow> {
    const { rows } = await this.query(
      `UPDATE games SET state = $2, status = $3, winner_id = $4, result = $5, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, state, status, winnerId || null, result || null]
    );
    return rows[0];
  }
}

export default new GameRepository();
