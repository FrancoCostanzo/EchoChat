-- Add 'sticker' message type for stickers and GIFs (Fase 9 — expresión visual).
-- The sticker/GIF payload (url, dimensions, source, kind) lives in messages.metadata;
-- the body stays NULL. Covers both animated GIFs and transparent stickers.
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_type_check
  CHECK (type IN (
    'text', 'media', 'location', 'contact', 'system', 'poll',
    'forwarded', 'deleted_placeholder', 'code', 'sticker'
  ));
