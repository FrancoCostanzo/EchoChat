-- Migration 004: wallpaper object type + dedicated MinIO bucket support
-- Run after 003_add_user_wallpapers.sql

ALTER TABLE storage_objects DROP CONSTRAINT IF EXISTS storage_objects_object_type_check;
ALTER TABLE storage_objects ADD CONSTRAINT storage_objects_object_type_check
  CHECK (object_type IN (
    'image', 'video', 'audio', 'voice', 'document',
    'thumbnail', 'recording', 'sticker', 'avatar', 'gif', 'other', 'wallpaper'
  ));
