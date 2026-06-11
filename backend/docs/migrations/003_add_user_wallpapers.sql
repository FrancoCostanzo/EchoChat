-- Migration 003: user wallpapers
-- Allows each user to set a wallpaper at three scopes:
--   global      -> applies to all conversations
--   type        -> applies to all conversations of a given type (direct, group, channel, broadcast, bot)
--   conversation-> applies to one specific conversation

CREATE TABLE IF NOT EXISTS user_wallpapers (
    user_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scope             VARCHAR(20) NOT NULL CHECK (scope IN ('global', 'type', 'conversation')),
    scope_key         VARCHAR(100) NOT NULL,
    -- 'global'             when scope = 'global'
    -- conversation type    when scope = 'type'   (direct|group|channel|broadcast|bot)
    -- conversation UUID    when scope = 'conversation'
    wallpaper_type    VARCHAR(20) NOT NULL CHECK (wallpaper_type IN ('preset', 'color', 'image')),
    wallpaper_value   VARCHAR(200),
    -- preset name          when wallpaper_type = 'preset'
    -- CSS color string     when wallpaper_type = 'color'
    -- NULL                 when wallpaper_type = 'image' (use storage_object_id)
    storage_object_id UUID REFERENCES storage_objects(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, scope, scope_key)
);

CREATE INDEX IF NOT EXISTS idx_user_wallpapers_user ON user_wallpapers(user_id);
