const hangman = require('../games/hangman');

// Shapes the game payload embedded into a message response. Any state that
// must stay hidden from a given viewer (the hangman word while active, an
// opponent's still-secret RPS choice) is redacted here — never sent as-is.
function toGameResponse(game, viewerId) {
  if (!game) return null;

  const yourRole = viewerId === game.player1_id
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
    return { ...base, board: game.state.board, turn: game.state.turn };
  }

  if (game.kind === 'rps') {
    const choices = { ...game.state.choices };
    if (game.status !== 'finished') {
      const opponentRole = yourRole === 'player1' ? 'player2' : yourRole === 'player2' ? 'player1' : null;
      if (opponentRole && choices[opponentRole]) choices[opponentRole] = 'hidden';
    }
    return { ...base, choices };
  }

  if (game.kind === 'hangman') {
    return {
      ...base,
      masked_word: hangman.maskWord(game.state),
      guessed: game.state.guessed,
      wrong: game.state.wrong,
      max_wrong: hangman.MAX_WRONG,
      word: game.status === 'finished' ? game.state.word : undefined,
    };
  }

  return base;
}

module.exports = { toGameResponse };
