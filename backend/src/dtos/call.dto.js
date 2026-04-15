const Joi = require('joi');

const initiateCallDto = Joi.object({
  conversation_id: Joi.string().uuid().allow(null),
  type: Joi.string().valid('voice', 'video', 'screen_share', 'conference').required(),
  participant_ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

const updateCallStatusDto = Joi.object({
  status: Joi.string().valid('ringing', 'active', 'ended', 'missed', 'rejected', 'failed').required(),
  end_reason: Joi.string().valid('hangup', 'timeout', 'no_answer', 'error', 'rejected').when('status', {
    is: 'ended',
    then: Joi.required(),
    otherwise: Joi.allow(null),
  }),
});

const updateParticipantDto = Joi.object({
  status: Joi.string().valid('ringing', 'joined', 'left', 'rejected', 'no_answer', 'busy'),
  can_speak: Joi.boolean(),
  can_video: Joi.boolean(),
  can_share_screen: Joi.boolean(),
  is_muted_by_host: Joi.boolean(),
}).min(1);

module.exports = {
  initiateCallDto,
  updateCallStatusDto,
  updateParticipantDto,
};
