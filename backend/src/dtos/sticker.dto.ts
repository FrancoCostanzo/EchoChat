import Joi from 'joi';

export interface SaveStickerRequest {
  object_id: string;
}

export const saveStickerDto = Joi.object<SaveStickerRequest>({
  object_id: Joi.string().uuid().required(),
});

export interface UpdateStickerRequest {
  name?: string | null;
  keywords?: string[];
  pack_id?: string | null;
  is_favorite?: boolean;
}

export const updateStickerDto = Joi.object<UpdateStickerRequest>({
  name: Joi.string().trim().max(80).allow('', null),
  keywords: Joi.array().items(Joi.string().trim().max(30)).max(10),
  pack_id: Joi.string().uuid().allow(null),
  is_favorite: Joi.boolean(),
}).min(1);

export interface CreatePackRequest {
  name: string;
}

export const createPackDto = Joi.object<CreatePackRequest>({
  name: Joi.string().trim().min(1).max(80).required(),
});

export interface UpdatePackRequest {
  name?: string;
  position?: number;
}

export const updatePackDto = Joi.object<UpdatePackRequest>({
  name: Joi.string().trim().min(1).max(80),
  position: Joi.number().integer().min(0),
}).min(1);
