/**
 * Minijuego embebido en un mensaje (message.game). Fuente de verdad en el
 * backend: backend/src/models/game.model.ts (toGameResponse). Ver la nota de
 * sincronización en types/user.ts.
 *
 * El backend devuelve una forma distinta según `kind` (armada con returns
 * tempranos, sin discriminar el tipo explícitamente). Acá se modela como
 * union discriminada por `kind` a propósito: es el mismo campo por el que ya
 * ramifica GameMessage.jsx, y así el compilador angosta `board`/`choices`/
 * `masked_word` automáticamente en cada rama en vez de dejarlos `unknown`.
 */
export type PlayerRole = 'player1' | 'player2';
export type TicTacToeMark = 'X' | 'O';
export type RpsChoice = 'rock' | 'paper' | 'scissors';

interface GameResponseBase {
  id: string;
  message_id: string;
  kind: string;
  player1_id: string;
  player2_id: string | null;
  status: string;
  winner_id: string | null;
  result: string | null;
  your_role: PlayerRole | null;
}

export interface TicTacToeGameResponse extends GameResponseBase {
  kind: 'tictactoe';
  board: (TicTacToeMark | null)[];
  turn: PlayerRole;
}

export interface RpsGameResponse extends GameResponseBase {
  kind: 'rps';
  /** 'hidden' reemplaza la elección del rival mientras la partida sigue abierta. */
  choices: Record<PlayerRole, RpsChoice | 'hidden' | null>;
}

export interface HangmanGameResponse extends GameResponseBase {
  kind: 'hangman';
  masked_word: string;
  guessed: string[];
  wrong: string[];
  max_wrong: number;
  /** Solo viaja cuando `status === 'finished'` (el backend la omite mientras sigue en juego). */
  word?: string;
}

export type GameResponse = TicTacToeGameResponse | RpsGameResponse | HangmanGameResponse;

export interface CreateGameRequest {
  conversation_id: string;
  kind: 'tictactoe' | 'rps' | 'hangman';
  /** Sólo para hangman: la palabra secreta que elige quien invita. */
  word?: string;
}

/** Una jugada trae exactamente uno de los tres campos, según el juego. */
export interface GameMoveRequest {
  cell?: number;
  choice?: RpsChoice;
  letter?: string;
}
