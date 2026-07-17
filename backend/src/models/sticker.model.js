// Compact shapes for the sticker collection API. The presigned URL is resolved
// by the service and passed in (repository rows only carry storage_object_id).
function toUserStickerResponse(row, url) {
  if (!row) return null;
  return {
    id: row.id,
    object_id: row.storage_object_id,
    url: url || null,
    name: row.name || null,
    keywords: row.keywords || [],
    pack_id: row.pack_id || null,
    is_favorite: !!row.is_favorite,
    width: row.image_width || null,
    height: row.image_height || null,
    mime_type: row.mime_type || null,
  };
}

function toStickerPackResponse(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    position: row.position,
  };
}

module.exports = { toUserStickerResponse, toStickerPackResponse };
