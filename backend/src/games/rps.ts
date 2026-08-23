// Pure Rock-Paper-Scissors rules: one round per game row (rematch = new game).

import type { PlayerRole, RpsChoice, RpsState } from '../models/game.model';

const BEATS: Record<RpsChoice, RpsChoice> = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
const VALID_CHOICES = new Set<string>(['rock', 'paper', 'scissors']);

function createInitialState(): RpsState {
  return { choices: { player1: null, player2: null }, winner: null };
}

/** Records `role`'s choice; resolves the round once both players have chosen. */
function applyChoice(state: RpsState, role: PlayerRole, choice: RpsChoice): RpsState {
  if (state.winner) throw new Error('Game already finished');
  if (!VALID_CHOICES.has(choice)) throw new Error('Invalid choice');
  if (state.choices[role]) throw new Error('You already chose');

  const choices = { ...state.choices, [role]: choice };
  let winner: RpsState['winner'] = null;
  if (choices.player1 && choices.player2) {
    if (choices.player1 === choices.player2) winner = 'draw';
    else winner = BEATS[choices.player1 as RpsChoice] === choices.player2 ? 'player1' : 'player2';
  }

  return { choices, winner };
}

export { createInitialState, applyChoice };
