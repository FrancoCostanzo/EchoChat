// Pure Hangman rules. Asymmetric by design: player1 (the inviter) picks/watches,
// player2 (the invitee) is the one guessing letters — enforced by the service.

import type { HangmanState } from '../models/game.model';

const MAX_WRONG = 6;

function createInitialState(word: string): HangmanState {
  return { word, guessed: [], wrong: [], winner: null };
}

function isFullyGuessed(word: string, guessed: string[]): boolean {
  const letters = new Set(word.toLowerCase().replace(/[^\p{L}]/gu, '').split(''));
  for (const letter of letters) {
    if (!guessed.includes(letter)) return false;
  }
  return true;
}

/** Guesser submits a single letter; throws if already finished/guessed. */
function applyGuess(state: HangmanState, letter: string): HangmanState {
  if (state.winner) throw new Error('Game already finished');
  const l = String(letter || '').toLowerCase();
  if (!l || l.length !== 1) throw new Error('Invalid letter');
  if (state.guessed.includes(l) || state.wrong.includes(l)) throw new Error('Letter already guessed');

  const isHit = state.word.toLowerCase().includes(l);
  const guessed = isHit ? [...state.guessed, l] : state.guessed;
  const wrong = isHit ? state.wrong : [...state.wrong, l];

  let winner: HangmanState['winner'] = null;
  if (isFullyGuessed(state.word, guessed)) winner = 'player2';
  else if (wrong.length >= MAX_WRONG) winner = 'player1';

  return { word: state.word, guessed, wrong, winner };
}

/** Blanks out letters not yet guessed; spaces always show through. */
function maskWord(state: HangmanState): string {
  return state.word
    .split('')
    .map((c) => (c === ' ' ? ' ' : state.guessed.includes(c.toLowerCase()) ? c : '_'))
    .join('');
}

export { createInitialState, applyGuess, maskWord, MAX_WRONG };
