-- Colección de stickers ampliada (Fase — expresión visual).
-- Separa "la obra" (storage_objects en MinIO, deduplicada por hash) de la
-- "entrada de colección" de cada usuario, para poder: guardar stickers que
-- mandan otros (referencia compartida), agruparlos en packs, ponerles nombre
-- y keywords para buscarlos, marcarlos como favoritos y llevar recientes.
-- Idempotente: se puede correr varias veces sin efectos.

-- Packs (grupos) por usuario
CREATE TABLE IF NOT EXISTS sticker_packs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(80) NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sticker_packs_owner ON sticker_packs(owner_id, position);

-- Entrada de colección: apunta a un storage_object (compartido / deduplicado)
CREATE TABLE IF NOT EXISTS user_stickers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_object_id UUID NOT NULL REFERENCES storage_objects(id) ON DELETE CASCADE,
  pack_id           UUID REFERENCES sticker_packs(id) ON DELETE SET NULL,
  name              VARCHAR(80),
  keywords          TEXT[] NOT NULL DEFAULT '{}',
  is_favorite       BOOLEAN NOT NULL DEFAULT FALSE,
  position          INTEGER NOT NULL DEFAULT 0,
  added_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_id, storage_object_id)          -- no duplicar el mismo sticker en mi colección
);
CREATE INDEX IF NOT EXISTS idx_user_stickers_owner    ON user_stickers(owner_id, position);
CREATE INDEX IF NOT EXISTS idx_user_stickers_object   ON user_stickers(storage_object_id);
CREATE INDEX IF NOT EXISTS idx_user_stickers_keywords ON user_stickers USING GIN (keywords);

-- Uso (recientes / frecuentes)
CREATE TABLE IF NOT EXISTS sticker_usage (
  owner_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_object_id UUID NOT NULL REFERENCES storage_objects(id) ON DELETE CASCADE,
  use_count         INTEGER NOT NULL DEFAULT 0,
  last_used_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (owner_id, storage_object_id)
);
CREATE INDEX IF NOT EXISTS idx_sticker_usage_recent ON sticker_usage(owner_id, last_used_at DESC);

-- Backfill: preservar las colecciones actuales (stickers subidos por cada usuario)
INSERT INTO user_stickers (owner_id, storage_object_id, added_at)
SELECT uploader_id, id, uploaded_at
FROM storage_objects
WHERE object_type = 'sticker' AND uploader_id IS NOT NULL
ON CONFLICT (owner_id, storage_object_id) DO NOTHING;
