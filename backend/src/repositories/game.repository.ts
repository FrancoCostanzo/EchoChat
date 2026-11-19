import BaseRepository from './base.repository';
import { now, json } from '../config/db/sql';
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
    const row = await this.db.insertInto('games')
      .values({ message_id, conversation_id, kind, player1_id, player2_id, state: json(state) })
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as GameRow;
  }

  async findByMessageId(messageId: string): Promise<GameRow | null> {
    const row = await this.db.selectFrom('games').selectAll().where('message_id', '=', messageId).executeTakeFirst();
    return (row as GameRow | undefined) ?? null;
  }

  async updateState(
    id: string,
    state: GameState,
    status: string,
    winnerId?: string | null,
    result?: string | null,
  ): Promise<GameRow> {
    const row = await this.db.updateTable('games')
      .set({ state: json(state), status, winner_id: winnerId || null, result: result || null, updated_at: now() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    return row as GameRow;
  }
}

export default new GameRepository();
