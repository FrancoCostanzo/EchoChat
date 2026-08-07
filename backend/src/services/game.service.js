const logger = require('../config/logger');
const {
  gameRepository,
  messageRepository,
  conversationRepository,
} = require('../repositories');
const { NotFoundError, ForbiddenError, BadRequestError } = require('../errors');
const { toMessageResponse, toGameResponse } = require('../models');
const tictactoe = require('../games/tictactoe');
const rps = require('../games/rps');
const hangman = require('../games/hangman');
const { toConversation, toUser } = require('../config/eventBus');


const KIND_LABELS = { tictactoe: 'Tatetí', rps: 'Piedra, papel o tijera', hangman: 'Ahorcado' };

class GameService {
  async createGame(userId, { conversation_id, kind, word }) {
    const conversation = await conversationRepository.findById(conversation_id);
    if (!conversation) throw new NotFoundError('Conversation');
    if (conversation.type !== 'direct') {
      throw new BadRequestError('Games can only be played in direct chats');
    }

    const member = await conversationRepository.getMember(conversation_id, userId);
    if (!member) throw new ForbiddenError('Not a member of this conversation');

    const members = await conversationRepository.getMembers(conversation_id);
    const opponent = members.find((m) => m.user_id !== userId);
    if (!opponent) throw new BadRequestError('No opponent to play with');

    let state;
    if (kind === 'tictactoe') state = tictactoe.createInitialState();
    else if (kind === 'rps') state = rps.createInitialState();
    else if (kind === 'hangman') {
      // Already pattern/length-validated by the DTO; this is just belt-and-braces.
      const trimmed = (word || '').trim();
      if (!/^[a-zA-Z]{2,20}$/.test(trimmed)) throw new BadRequestError('Invalid word');
      state = hangman.createInitialState(trimmed);
    }
    else throw new BadRequestError('Unknown game kind');

    // The invite lives on a message of type 'game'; body holds a short
    // human-readable label (search/preview), the real state lives in `games`.
    const message = await messageRepository.create({
      conversation_id,
      sender_id: userId,
      type: 'game',
      body: `${KIND_LABELS[kind] || kind} — invitación a jugar`,
    });

    const game = await gameRepository.createGame({
      message_id: message.id,
      conversation_id,
      kind,
      player1_id: userId,
      player2_id: opponent.user_id,
      state,
    });

    const response = await this._buildMessageWithGame(message.id, userId);
    try {
      toConversation(conversation_id, 'message:new', response);
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to emit message:new (game)');
    }
    logger.info({ gameId: game.id, kind, conversationId: conversation_id }, 'Game created');
    return response;
  }

  async move(userId, gameId, payload) {
    const game = await gameRepository.findById(gameId);
    if (!game) throw new NotFoundError('Game');
    if (game.status !== 'active') throw new BadRequestError('Game already finished');

    let role;
    if (game.player1_id === userId) role = 'player1';
    else if (game.player2_id === userId) role = 'player2';
    else throw new ForbiddenError('Not a player in this game');

    let nextState;
    try {
      if (game.kind === 'tictactoe') {
        if (payload.cell === undefined) throw new BadRequestError('Missing cell');
        nextState = tictactoe.applyMove(game.state, role, payload.cell);
      } else if (game.kind === 'rps') {
        if (!payload.choice) throw new BadRequestError('Missing choice');
        nextState = rps.applyChoice(game.state, role, payload.choice);
      } else if (game.kind === 'hangman') {
        if (role !== 'player2') throw new ForbiddenError('Only the guesser can guess letters');
        if (!payload.letter) throw new BadRequestError('Missing letter');
        nextState = hangman.applyGuess(game.state, payload.letter);
      } else {
        throw new BadRequestError('Unknown game kind');
      }
    } catch (err) {
      if (err instanceof BadRequestError || err instanceof ForbiddenError) throw err;
      throw new BadRequestError(err.message);
    }

    const finished = !!nextState.winner;
    const winnerId = finished && nextState.winner !== 'draw'
      ? (nextState.winner === 'player1' ? game.player1_id : game.player2_id)
      : null;
    const result = finished ? (nextState.winner === 'draw' ? 'draw' : 'win') : null;

    const updated = await gameRepository.updateState(
      game.id, nextState, finished ? 'finished' : 'active', winnerId, result,
    );

    // Emitted per-player personal room (not the shared conv room) so each
    // viewer gets their own redacted copy — RPS hides the opponent's choice
    // until both have picked.
    for (const uid of [game.player1_id, game.player2_id]) {
      try {
        toUser(uid, 'game:update', {
          conversationId: game.conversation_id,
          messageId: game.message_id,
          game: toGameResponse(updated, uid),
        });
      } catch (err) {
        logger.warn({ err: err.message }, 'Failed to emit game:update');
      }
    }
    return toGameResponse(updated, userId);
  }

  async getByMessage(messageId, userId) {
    const game = await gameRepository.findByMessageId(messageId);
    if (!game) return null;
    return toGameResponse(game, userId);
  }

  async _buildMessageWithGame(messageId, userId) {
    const full = await messageRepository.findWithAttachments(messageId);
    const response = toMessageResponse(full);
    response.game = await this.getByMessage(messageId, userId);
    return response;
  }
}

module.exports = new GameService();
