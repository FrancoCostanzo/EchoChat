const Joi = require('joi');

const uploadMetadataDto = Joi.object({
  original_filename: Joi.string().max(500).required(),
  mime_type: Joi.string().max(100).required(),
  file_size_bytes: Joi.number().integer().positive().required(),
  object_type: Joi.string().valid(
    'image', 'video', 'audio', 'voice', 'document',
    'thumbnail', 'recording', 'sticker', 'avatar', 'gif', 'wallpaper', 'other'
  ).required(),
  image_width: Joi.number().integer().positive().allow(null),
  image_height: Joi.number().integer().positive().allow(null),
  duration_ms: Joi.number().integer().positive().allow(null),
});

module.exports = {
  uploadMetadataDto,
};
