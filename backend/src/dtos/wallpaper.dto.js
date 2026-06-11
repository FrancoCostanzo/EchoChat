const Joi = require('joi');

const CONV_TYPES = ['direct', 'group', 'channel', 'broadcast', 'bot'];

const upsertWallpaperDto = Joi.object({
  scope: Joi.string().valid('global', 'type', 'conversation').required(),
  scope_key: Joi.when('scope', {
    switch: [
      { is: 'global',       then: Joi.string().valid('global').required() },
      { is: 'type',         then: Joi.string().valid(...CONV_TYPES).required() },
      { is: 'conversation', then: Joi.string().uuid().required() },
    ],
  }),
  wallpaper_type: Joi.string().valid('preset', 'color', 'image').required(),
  wallpaper_value: Joi.when('wallpaper_type', {
    switch: [
      { is: 'preset', then: Joi.string().max(100).required() },
      { is: 'color',  then: Joi.string().max(50).required() },
      { is: 'image',  then: Joi.string().allow(null, '').optional() },
    ],
  }),
  storage_object_id: Joi.when('wallpaper_type', {
    is: 'image',
    then: Joi.string().uuid().required(),
    otherwise: Joi.string().uuid().allow(null).optional(),
  }),
});

module.exports = { upsertWallpaperDto };
