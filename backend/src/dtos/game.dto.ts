import Joi from 'joi';

export interface CreateGameRequest {
  conversation_id: string;
  kind: 'tictactoe' | 'rps' | 'hangman';
  /** Sólo para hangman: la palabra secreta que elige quien invita. */
  word?: string;
}

export const createGameDto = Joi.object<CreateGameRequest>({
  conversation_id: Joi.string().uuid().required(),
  kind: Joi.string().valid('tictactoe', 'rps', 'hangman').required(),
  // The inviter picks the secret word for hangman — never sent to the guesser.
  word: Joi.string().pattern(/^[a-zA-Z]+$/).min(2).max(20).when('kind', {
    is: 'hangman',
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
});

/** Una jugada trae exactamente uno de los tres campos, según el juego. */
export interface GameMoveRequest {
  cell?: number;
  choice?: 'rock' | 'paper' | 'scissors';
  letter?: string;
}

export const gameMoveDto = Joi.object<GameMoveRequest>({
  cell: Joi.number().integer().min(0).max(8),
  choice: Joi.string().valid('rock', 'paper', 'scissors'),
  letter: Joi.string().length(1),
}).or('cell', 'choice', 'letter');
