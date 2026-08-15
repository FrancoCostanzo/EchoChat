// Pure Tic-Tac-Toe rules: no I/O, no persistence — the service layer owns that.

import type { PlayerRole, TicTacToeMark, TicTacToeState } from '../models/game.model';

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function createInitialState(): TicTacToeState {
  return { board: Array(9).fill(null), turn: 'player1', winner: null };
}

function checkWinnerMark(board: (TicTacToeMark | null)[]): TicTacToeMark | 'draw' | null {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return board.every((cell) => cell !== null) ? 'draw' : null;
}

/** Applies a move for `role` ('player1' | 'player2') at `cell` (0-8). Throws on illegal moves. */
function applyMove(state: TicTacToeState, role: PlayerRole, cell: number): TicTacToeState {
  if (state.winner) throw new Error('Game already finished');
  if (state.turn !== role) throw new Error('Not your turn');
  if (!Number.isInteger(cell) || cell < 0 || cell > 8) throw new Error('Invalid cell');
  if (state.board[cell]) throw new Error('Cell already taken');

  const board = [...state.board];
  board[cell] = role === 'player1' ? 'X' : 'O';
  const mark = checkWinnerMark(board);
  const winner = mark === 'draw' ? 'draw' : mark === 'X' ? 'player1' : mark === 'O' ? 'player2' : null;

  return {
    board,
    turn: winner ? state.turn : (role === 'player1' ? 'player2' : 'player1'),
    winner,
  };
}

export { createInitialState, applyMove };
