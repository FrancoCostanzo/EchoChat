-- Add 'code' message type for dedicated code snippets (Fase 8.3)
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_type_check
  CHECK (type IN (
    'text', 'media', 'location', 'contact', 'system', 'poll',
    'forwarded', 'deleted_placeholder', 'code'
  ));
