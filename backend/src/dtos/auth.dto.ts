import Joi from 'joi';

export type DeviceType = 'web' | 'desktop' | 'mobile' | 'api';
export type Presence = 'online' | 'offline' | 'away' | 'busy' | 'dnd';

export interface RegisterRequest {
  username: string;
  display_name: string;
  email?: string | null;
  password: string;
  phone_extension?: string | null;
  department?: string | null;
  job_title?: string | null;
}

export const registerDto = Joi.object<RegisterRequest>({
  username: Joi.string().pattern(/^[a-zA-Z0-9._]+$/).min(3).max(50).required()
    .messages({ 'string.pattern.base': 'Username can only contain letters, numbers, dots and underscores' }),
  display_name: Joi.string().max(100).required(),
  email: Joi.string().email().allow(null, ''),
  password: Joi.string().min(8).max(128).required(),
  phone_extension: Joi.string().max(20).allow(null, ''),
  department: Joi.string().max(100).allow(null, ''),
  job_title: Joi.string().max(100).allow(null, ''),
});

export interface LoginRequest {
  username: string;
  password: string;
  device_name?: string | null;
  device_type?: DeviceType;
}

export const loginDto = Joi.object<LoginRequest>({
  username: Joi.string().required(),
  password: Joi.string().required(),
  device_name: Joi.string().max(100).allow(null, ''),
  device_type: Joi.string().valid('web', 'desktop', 'mobile', 'api').default('web'),
});

export interface UpdateProfileRequest {
  display_name?: string;
  email?: string | null;
  phone_extension?: string | null;
  department?: string | null;
  job_title?: string | null;
  presence?: Presence;
  presence_message?: string | null;
  timezone?: string;
  locale?: string;
}

export const updateProfileDto = Joi.object<UpdateProfileRequest>({
  display_name: Joi.string().max(100),
  email: Joi.string().email().allow(null, ''),
  phone_extension: Joi.string().max(20).allow(null, ''),
  department: Joi.string().max(100).allow(null, ''),
  job_title: Joi.string().max(100).allow(null, ''),
  presence: Joi.string().valid('online', 'offline', 'away', 'busy', 'dnd'),
  presence_message: Joi.string().max(200).allow(null, ''),
  timezone: Joi.string().max(50),
  locale: Joi.string().max(10),
}).min(1);

/**
 * Estado de ausencia: un solo texto que se muestra al lado del nombre y —si
 * `auto_reply` está activo— se responde solo en los chats directos.
 */
export interface AwayStateRequest {
  message: string;
  /** Cuándo vence. Sin fecha, la ausencia queda hasta que se limpie a mano. */
  until?: Date | string | null;
  auto_reply?: boolean;
}

export const awayStateDto = Joi.object<AwayStateRequest>({
  message: Joi.string().max(200).required(),
  until: Joi.date().iso().greater('now').allow(null),
  auto_reply: Joi.boolean().default(false),
});

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export const changePasswordDto = Joi.object<ChangePasswordRequest>({
  current_password: Joi.string().required(),
  new_password: Joi.string().min(8).max(128).required(),
});

// 2FA DTOs
export interface TotpChallengeRequest {
  temp_token: string;
  code: string;
  device_name?: string | null;
  device_type?: DeviceType;
}

export const totpChallengeDto = Joi.object<TotpChallengeRequest>({
  temp_token: Joi.string().required(),
  code: Joi.string().min(5).max(15).required(),
  device_name: Joi.string().max(100).allow(null, ''),
  device_type: Joi.string().valid('web', 'desktop', 'mobile', 'api').default('web'),
});

export interface TotpCodeRequest {
  code: string;
}

export const totpEnableDto = Joi.object<TotpCodeRequest>({
  code: Joi.string().length(6).pattern(/^\d{6}$/).required()
    .messages({ 'string.pattern.base': 'Code must be 6 digits' }),
});

export interface TotpDisableRequest {
  password: string;
  code: string;
}

export const totpDisableDto = Joi.object<TotpDisableRequest>({
  password: Joi.string().required(),
  code: Joi.string().length(6).pattern(/^\d{6}$/).required()
    .messages({ 'string.pattern.base': 'Code must be 6 digits' }),
});

export const totpRegenerateDto = Joi.object<TotpCodeRequest>({
  code: Joi.string().length(6).pattern(/^\d{6}$/).required()
    .messages({ 'string.pattern.base': 'Code must be 6 digits' }),
});
