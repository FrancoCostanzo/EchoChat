import type { Row } from '../types/rows';

const hangman = require('../games/hangman');

/** Rol de un jugador dentro de una partida. */
export type PlayerRole = 'player1' | 'player2';

/**
 * Forma del JSON de `games.state`, que en la base es una columna `jsonb` sin
 * estructura declarada. Cada variante la produce el módulo puro de `games/`.
 */
export type TicTacToeState = {
  board: (PlayerRole | null)[];
  turn: PlayerRole;
  winner: PlayerRole | 'draw' | null;
};
export type RpsState = {
  choices: Record<PlayerRole, string | null>;
  winner: PlayerRole | 'draw' | null;
};
export type HangmanState = {
  word: string;
  guessed: string[];
  wrong: string[];
  winner: PlayerRole | null;
};
export type GameState = TicTacToeState | RpsState | HangmanState;

export type GameRow = Omit<Row<'games'>, 'state'> & { state: GameState };

// Shapes the game payload embedded into a message response. Any state that
// must stay hidden from a given viewer (the hangman word while active, an
// opponent's still-secret RPS choice) is redacted here — never sent as-is.
export function toGameResponse(game: GameRow | null | undefined, viewerId: string | null) {
  if (!game) return null;

  const yourRole: PlayerRole | null = viewerId === game.player1_id
    ? 'player1'
    : viewerId === game.player2_id ? 'player2' : null;

  const base = {
    id: game.id,
    message_id: game.message_id,
    kind: game.kind,
    player1_id: game.player1_id,
    player2_id: game.player2_id,
    status: game.status,
    winner_id: game.winner_id,
    result: game.result,
    your_role: yourRole,
  };

  if (game.kind === 'tictactoe') {
    const state = game.state as TicTacToeState;
    return { ...base, board: state.board, turn: state.turn };
  }

  if (game.kind === 'rps') {
    const choices = { ...(game.state as RpsState).choices };
    if (game.status !== 'finished') {
      const opponentRole = yourRole === 'player1' ? 'player2' : yourRole === 'player2' ? 'player1' : null;
      if (opponentRole && choices[opponentRole]) choices[opponentRole] = 'hidden';
    }
    return { ...base, choices };
  }

  if (game.kind === 'hangman') {
    const state = game.state as HangmanState;
    return {
      ...base,
      masked_word: hangman.maskWord(state),
      guessed: state.guessed,
      wrong: state.wrong,
      max_wrong: hangman.MAX_WRONG,
      word: game.status === 'finished' ? state.word : undefined,
    };
  }

  return base;
}

export type GameResponse = NonNullable<ReturnType<typeof toGameResponse>>;
