import Joi from 'joi';

export interface AdminCreateUserRequest {
  username: string;
  display_name: string;
  email?: string | null;
  /** Obligatoria salvo que se mande invitación: ahí la elige el usuario. */
  password?: string;
  /** Manda un email con un link para que el usuario active la cuenta. */
  send_invite?: boolean;
  department?: string | null;
  job_title?: string | null;
  role_names?: string[];
}

export const adminCreateUserDto = Joi.object<AdminCreateUserRequest>({
  username: Joi.string().pattern(/^[a-zA-Z0-9._]+$/).min(3).max(50).required(),
  display_name: Joi.string().max(100).required(),
  email: Joi.string().email().allow(null, '')
    .when('send_invite', { is: true, then: Joi.string().email().required() }),
  password: Joi.string().min(8)
    .when('send_invite', { is: true, then: Joi.forbidden(), otherwise: Joi.required() }),
  send_invite: Joi.boolean().default(false),
  department: Joi.string().max(100).allow(null, ''),
  job_title: Joi.string().max(100).allow(null, ''),
  role_names: Joi.array().items(Joi.string()).default(['user']),
});

export const adminEmailTestDto = Joi.object<{ to?: string }>({
  to: Joi.string().email(),
});

export interface AdminUpdateUserRequest {
  display_name?: string;
  email?: string | null;
  department?: string | null;
  job_title?: string | null;
  status?: 'active' | 'inactive' | 'suspended';
  role_names?: string[];
}

export const adminUpdateUserDto = Joi.object<AdminUpdateUserRequest>({
  display_name: Joi.string().max(100),
  email: Joi.string().email().allow(null, ''),
  department: Joi.string().max(100).allow(null, ''),
  job_title: Joi.string().max(100).allow(null, ''),
  status: Joi.string().valid('active', 'inactive', 'suspended'),
  role_names: Joi.array().items(Joi.string()),
}).min(1);

export interface AdminResetPasswordRequest {
  password: string;
}

export const adminResetPasswordDto = Joi.object<AdminResetPasswordRequest>({
  password: Joi.string().min(8).max(128).required(),
});

export interface AdminUpdateSettingRequest {
  /** Los settings guardan valores heterogéneos (string, número, lista, objeto). */
  value: unknown;
}

export const adminUpdateSettingDto = Joi.object<AdminUpdateSettingRequest>({
  value: Joi.alternatives()
    .try(Joi.string(), Joi.number(), Joi.boolean(), Joi.array(), Joi.object())
    .required(),
});
