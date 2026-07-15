const Joi = require('joi');

const createGameDto = Joi.object({
  conversation_id: Joi.string().uuid().required(),
  kind: Joi.string().valid('tictactoe', 'rps', 'hangman').required(),
  // The inviter picks the secret word for hangman — never sent to the guesser.
  word: Joi.string().pattern(/^[a-zA-Z]+$/).min(2).max(20).when('kind', {
    is: 'hangman',
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
});

const gameMoveDto = Joi.object({
  cell: Joi.number().integer().min(0).max(8),
  choice: Joi.string().valid('rock', 'paper', 'scissors'),
  letter: Joi.string().length(1),
}).or('cell', 'choice', 'letter');

module.exports = {
  createGameDto,
  gameMoveDto,
};
