
const Joi  = require('joi');
const { J } = require('../middleware/validate');

const { ROLES } = require('../constants/roles');

const password = Joi.string()
  .min(8)
  .max(72)                        // bcrypt truncates at 72 chars
  .pattern(/[A-Z]/, 'uppercase')
  .pattern(/[0-9]/, 'number')
  .messages({
    'string.min':              'Password must be at least 8 characters.',
    'string.pattern.name':     'Password must contain at least one uppercase letter and one number.',
  });

const email = Joi.string().email({ tlds: { allow: false } }).lowercase().trim();

const registerSchema = Joi.object({
  full_name: Joi.string().min(2).max(100).trim().required(),
  email:     email.required(),
  phone:     J.phone.required(),
  password:  password.required(),

  role: Joi.string()
    .valid(...Object.values(ROLES))
    .default(ROLES.CUSTOMER),

  transporter_id: J.uuid.optional(),
  agent_id:       J.uuid.optional(),
  agency_id:      J.uuid.optional(),
});


const loginSchema = Joi.object({
  email:    email.required(),
  password: Joi.string().required(),
});


const sendOtpSchema = Joi.object({
  contact: Joi.alternatives()
    .try(email, J.phone)
    .required()
    .messages({ 'alternatives.match': 'Contact must be a valid email or Kenyan phone number.' }),

  purpose: Joi.string()
    .valid('login', 'registration', 'password_reset')
    .default('login'),
});

/* ============================================================
   VERIFY OTP  (Step 2 — returns JWT)
   POST /api/v1/auth/verify-otp
   ============================================================ */

const verifyOtpSchema = Joi.object({
  contact: Joi.alternatives()
    .try(email, J.phone)
    .required(),

  otp: Joi.string()
    .length(6)
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      'string.length':       'OTP must be exactly 6 digits.',
      'string.pattern.base': 'OTP must contain digits only.',
    }),
});

/* ============================================================
   FORGOT PASSWORD
   POST /api/v1/auth/forgot-password
   ============================================================ */

const forgotPasswordSchema = Joi.object({
  email: email.required(),
});

/* ============================================================
   RESET PASSWORD
   POST /api/v1/auth/reset-password
   ============================================================ */

const resetPasswordSchema = Joi.object({
  email:        email.required(),
  otp:          Joi.string().length(6).pattern(/^\d{6}$/).required(),
  new_password: password.required(),
  confirm_password: Joi.string()
    .valid(Joi.ref('new_password'))
    .required()
    .messages({ 'any.only': 'Passwords do not match.' }),
});


const updateProfileSchema = Joi.object({
  full_name:    Joi.string().min(2).max(100).trim(),
  phone:        J.phone,
  email:        email,
  id_number:    Joi.string().min(6).max(20).trim(),
  date_of_birth: Joi.date().iso().max('now'),
}).min(1).messages({ 'object.min': 'At least one field must be provided.' });


const adminCreateUserSchema = Joi.object({
  full_name:      Joi.string().min(2).max(100).trim().required(),
  email:          email.required(),
  phone:          J.phone.required(),
  password:       password.required(),
  role:           Joi.string().valid(...Object.values(ROLES)).required(),
  transporter_id: J.uuid.optional(),
  agent_id:       J.uuid.optional(),
  agency_id:      J.uuid.optional(),
});

/* ============================================================
   ADMIN — UPDATE USER
   PATCH /api/v1/admin/users/:id
   ============================================================ */

const adminUpdateUserSchema = Joi.object({
  full_name:         Joi.string().min(2).max(100).trim(),
  phone:             J.phone,
  email:             email,
  role:              Joi.string().valid(...Object.values(ROLES)),
  is_active:         Joi.boolean(),
  compliance_status: Joi.string().valid('pending', 'approved', 'rejected', 'resubmission_required'),
  data_locked:       Joi.boolean(),
  transporter_id:    J.uuid.allow(null),
  agent_id:          J.uuid.allow(null),
  agency_id:         J.uuid.allow(null),
}).min(1);

/* ============================================================
   LIST USERS QUERY (GET /api/v1/admin/users)
   ============================================================ */

const listUsersQuerySchema = Joi.object({
  role:              Joi.string().valid(...Object.values(ROLES)),
  compliance_status: Joi.string().valid('pending', 'approved', 'rejected', 'resubmission_required'),
  is_active:         Joi.boolean(),
  search:            Joi.string().max(100).trim(),   // name / email / phone
  page:              J.page,
  limit:             J.limit,
});

/* ============================================================
   UUID PARAM  (shared — for any /:id route)
   ============================================================ */

const uuidParamSchema = Joi.object({
  id: J.uuid.required(),
});

module.exports = {
  registerSchema,
  loginSchema,
  sendOtpSchema,
  verifyOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  adminCreateUserSchema,
  adminUpdateUserSchema,
  listUsersQuerySchema,
  uuidParamSchema,
};