-- Add 'game' message type for in-chat mini-games (Tic-Tac-Toe, Rock-Paper-
-- Scissors, Hangman) in direct/personal conversations. Game state (board,
-- turn, choices, word) lives in the new `games` table, referenced by
-- messages.id — same pattern as `polls.message_id`.
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_type_check
  CHECK (type IN (
    'text', 'media', 'location', 'contact', 'system', 'poll',
    'forwarded', 'deleted_placeholder', 'code', 'sticker', 'game'
  ));

CREATE TABLE IF NOT EXISTS games (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id       UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    kind             VARCHAR(20) NOT NULL CHECK (kind IN ('tictactoe','rps','hangman')),
    player1_id       UUID NOT NULL REFERENCES users(id),
    player2_id       UUID NOT NULL REFERENCES users(id),
    state            JSONB NOT NULL DEFAULT '{}',
    status           VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','finished')),
    winner_id        UUID REFERENCES users(id),
    result           VARCHAR(20) CHECK (result IN ('win','draw')),
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_games_message ON games(message_id);
