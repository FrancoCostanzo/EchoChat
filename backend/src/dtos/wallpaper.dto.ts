import Joi from 'joi';

const CONV_TYPES = ['direct', 'group', 'channel', 'broadcast', 'bot'];

export interface UpsertWallpaperRequest {
  scope: 'global' | 'type' | 'conversation';
  /**
   * Depende de `scope`: la palabra 'global', un tipo de conversación, o el id
   * de una conversación.
   */
  scope_key: string;
  wallpaper_type: 'preset' | 'color' | 'image';
  wallpaper_value?: string | null;
  /** Obligatorio cuando `wallpaper_type` es 'image'. */
  storage_object_id?: string | null;
}

export const upsertWallpaperDto = Joi.object<UpsertWallpaperRequest>({
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
