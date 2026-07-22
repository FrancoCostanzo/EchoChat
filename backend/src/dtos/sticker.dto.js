const Joi = require('joi');

const saveStickerDto = Joi.object({
  object_id: Joi.string().uuid().required(),
});

const updateStickerDto = Joi.object({
  name: Joi.string().trim().max(80).allow('', null),
  keywords: Joi.array().items(Joi.string().trim().max(30)).max(10),
  pack_id: Joi.string().uuid().allow(null),
  is_favorite: Joi.boolean(),
}).min(1);

const createPackDto = Joi.object({
  name: Joi.string().trim().min(1).max(80).required(),
});

const updatePackDto = Joi.object({
  name: Joi.string().trim().min(1).max(80),
  position: Joi.number().integer().min(0),
}).min(1);

module.exports = {
  saveStickerDto,
  updateStickerDto,
  createPackDto,
  updatePackDto,
};
