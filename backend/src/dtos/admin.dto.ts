import Joi from 'joi';

export interface AdminCreateUserRequest {
  username: string;
  display_name: string;
  email?: string | null;
  password: string;
  department?: string | null;
  job_title?: string | null;
  role_names?: string[];
}

export const adminCreateUserDto = Joi.object<AdminCreateUserRequest>({
  username: Joi.string().pattern(/^[a-zA-Z0-9._]+$/).min(3).max(50).required(),
  display_name: Joi.string().max(100).required(),
  email: Joi.string().email().allow(null, ''),
  password: Joi.string().min(8).required(),
  department: Joi.string().max(100).allow(null, ''),
  job_title: Joi.string().max(100).allow(null, ''),
  role_names: Joi.array().items(Joi.string()).default(['user']),
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
