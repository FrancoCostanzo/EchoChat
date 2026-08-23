import Joi from 'joi';

export type CallType = 'voice' | 'video' | 'screen_share' | 'conference';
export type CallStatus = 'ringing' | 'active' | 'ended' | 'missed' | 'rejected' | 'failed';
export type CallEndReason = 'hangup' | 'timeout' | 'no_answer' | 'error' | 'rejected';
export type ParticipantStatus = 'ringing' | 'joined' | 'left' | 'rejected' | 'no_answer' | 'busy';

export interface InitiateCallRequest {
  conversation_id?: string | null;
  type: CallType;
  participant_ids: string[];
}

export const initiateCallDto = Joi.object<InitiateCallRequest>({
  conversation_id: Joi.string().uuid().allow(null),
  type: Joi.string().valid('voice', 'video', 'screen_share', 'conference').required(),
  participant_ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

export interface UpdateCallStatusRequest {
  status: CallStatus;
  /** Obligatorio cuando el estado es 'ended'. */
  end_reason?: CallEndReason | null;
}

export const updateCallStatusDto = Joi.object<UpdateCallStatusRequest>({
  status: Joi.string().valid('ringing', 'active', 'ended', 'missed', 'rejected', 'failed').required(),
  end_reason: Joi.string().valid('hangup', 'timeout', 'no_answer', 'error', 'rejected').when('status', {
    is: 'ended',
    then: Joi.required(),
    otherwise: Joi.allow(null),
  }),
});

export interface UpdateParticipantRequest {
  status?: ParticipantStatus;
  can_speak?: boolean;
  can_video?: boolean;
  can_share_screen?: boolean;
  is_muted_by_host?: boolean;
}

export const updateParticipantDto = Joi.object<UpdateParticipantRequest>({
  status: Joi.string().valid('ringing', 'joined', 'left', 'rejected', 'no_answer', 'busy'),
  can_speak: Joi.boolean(),
  can_video: Joi.boolean(),
  can_share_screen: Joi.boolean(),
  is_muted_by_host: Joi.boolean(),
}).min(1);
