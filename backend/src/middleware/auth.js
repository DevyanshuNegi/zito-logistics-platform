const prisma = require('../utils/prisma');
const { verifyJwt } = require('../utils/jwt');
const { ROLES, ADMIN_ROLES } = require('../constants/roles');
const { ERRORS, buildError } = require('../constants/errors');
const ALL_ROLES = Object.values(ROLES);
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(ERRORS.UNAUTHORIZED.httpStatus).json(buildError(ERRORS.AUTH_REQUIRED));
    }
    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = verifyJwt(token);
    } catch (jwtErr) {
      const code = jwtErr.name === 'TokenExpiredError'
        ? 'TOKEN_EXPIRED'
        : 'INVALID_TOKEN';
      return res.status(401).json(buildError(ERRORS[code] || ERRORS.TOKEN_INVALID));
    }
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        role: true,
        email: true,
        full_name: true,
        phone: true,
        isActive: true,
        deletedAt: true,
        complianceStatus: true,
        dataLocked: true,
        transporterId: true,
        agentId: true,
        agencyId: true,
      }
    });
    if (!user) {
      return res.status(ERRORS.USER_NOT_FOUND.httpStatus).json(buildError(ERRORS.USER_NOT_FOUND));
    }
    if (user.deletedAt) {
      return res.status(401).json(buildError(ERRORS.ACCOUNT_DEACTIVATED, 'This account has been removed.'));
    }
    if (!user.isActive) {
      return res.status(401).json(buildError(ERRORS.ACCOUNT_DEACTIVATED, 'Account is suspended.'));
    }
    if (decoded.acting_as && user.role === ROLES.SUPER_ADMIN) {
      req.adminUser = user;
      req.user = { ...user, role: decoded.acting_as, isImpersonated: true };
      req.viewAs = true;
    } else {
      req.user = user;
    }
    next();
  } catch (err) {
    console.error('❌ authenticate() error:', err.message);
    return res.status(500).json({
      success: false,
      error: { code: 'AUTH_ERROR', message: 'Authentication failed' }
    });
  }
};
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
      });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code:    'FORBIDDEN',
          message: `Access denied. Allowed role(s): ${roles.join(', ')}`
        }
      });
    }

    next();
  };
};
const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
    });
  }

  if (!ADMIN_ROLES.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      error: { code: 'ADMIN_ONLY', message: 'Admin access required' }
    });
  }

  next();
};
const isSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== ROLES.SUPER_ADMIN) {
    return res.status(403).json({
      success: false,
      error: {
        code:    'SUPER_ADMIN_ONLY',
        message: 'Super Admin access required for this action'
      }
    });
  }
  next();
};
const isFinanceOrSuper = (req, res, next) => {
  const allowed = [ROLES.SUPER_ADMIN, ROLES.FINANCE_ADMIN];
  if (!req.user || !allowed.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      error: {
        code:    'FINANCE_ADMIN_ONLY',
        message: 'Finance Admin access required'
      }
    });
  }
  next();
};
const requireCompliance = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
    });
  }
  const complianceRoles = [ROLES.DRIVER, ROLES.TRANSPORTER];
  if (!complianceRoles.includes(req.user.role)) {
    return next();
  }
  let status = req.user.complianceStatus;
  if (req.user.role === ROLES.DRIVER) {
    const { checkDriverExpiry } = require('../services/compliance.service');
    const updatedStatus = await checkDriverExpiry(req.user.id);
    if (updatedStatus) {
      status = updatedStatus;
    }
  }
  if (status === 'approved') return next();
  const messages = {
    pending:               'Your account is under review. You cannot perform this action yet.',
    rejected:              'Your account has been rejected. Please contact support.',
    resubmission_required: 'Document resubmission required before you can continue.',
  };
  return res.status(403).json({
    success: false,
    error: {
      code:               'COMPLIANCE_REQUIRED',
      message:            messages[status] || 'Account not yet approved.',
      compliance_status:  status
    }
  });
};
const applyScope = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json(buildError(ERRORS.UNAUTHORIZED));
  }
  const { role, id } = req.user;
  switch (role) {
    case ROLES.SUPER_ADMIN:
    case ROLES.OPERATIONS_ADMIN:
    case ROLES.FINANCE_ADMIN:
      req.scope = { isAdmin: true };
      break;
    case ROLES.TRANSPORTER:
      req.scope = { isAdmin: false, transporter_id: req.user.transporterId || id };
      break;
    case ROLES.AGENT:
      req.scope = { isAdmin: false, agent_id: req.user.agentId || id };
      break;
    case ROLES.AGENCY:
      req.scope = { isAdmin: false, agency_id: req.user.agencyId || id };
      break;
    case ROLES.DRIVER:
      req.scope = { isAdmin: false, driver_id: id };
      break;
    case ROLES.CUSTOMER:
      req.scope = { isAdmin: false, customer_id: id };
      break;
    case ROLES.WAREHOUSE_PARTNER:
      req.scope = { isAdmin: false, partner_id: id };
      break;
    case ROLES.SGR_OPERATOR:
      req.scope = { isAdmin: false, operator_id: id };
      break;
    default:
      return res.status(403).json(buildError(ERRORS.SCOPE_VIOLATION));
  }
  next();
};
const viewAs = async (req, res, next) => {
  const viewAsId = req.headers['x-view-as-user'];
  if (!viewAsId) return next(); // Header not present — normal request
  if (!req.user || req.user.role !== ROLES.SUPER_ADMIN) {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Only Super Admin can use View As mode' }
    });
  }
  try {
    const targetUser = await prisma.user.findUnique({ where: { id: viewAsId } });
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'View As target user not found' }
      });
    }
    if (targetUser.deletedAt || !targetUser.isActive) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_VIEW_AS', message: 'Cannot view as an inactive or deleted user' }
      });
    }
    req.adminUser = req.user;   // preserve real admin identity for audit
    req.user      = targetUser; // replace scope with impersonated user
    req.viewAs    = true;
    next();
  } catch (err) {
    console.error('❌ viewAs() error:', err.message);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'View As failed' }
    });
  }
};
const auditLogger = (req, _res, next) => {
  req.auditLog = async (action, details = {}) => {
    try {
      await prisma.auditLog.create({
        data: {
          userId:       req.adminUser?.id || req.user?.id || null,
          actingAs:     req.viewAs ? req.adminUser?.role : req.user?.role,
          viewAsUser:   req.viewAs ? req.user?.id : null,
          action,
          details:      details, // Prisma handles JSONB directly
          ipAddress:    req.ip || req.headers['x-forwarded-for'] || null,
          userAgent:    req.headers['user-agent'] || null,
        }
      });
    } catch (err) {
      // Non-fatal — never let audit failure break the main request
      console.error('❌ auditLog() write failed (non-fatal):', err.message);
    }
  };
  next();
};
const LOCKED_FIELDS = [
  'full_name', 'id_number', 'email', 'phone',
  'license_number', 'plate_number', 'kra_pin',
  'date_of_birth', 'national_id',
];
const checkDataLock = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
    });
  }
  if (ADMIN_ROLES.includes(req.user.role)) return next();
  if (req.user.dataLocked) {
    const attemptedLockedFields = Object.keys(req.body)
      .filter(key => LOCKED_FIELDS.includes(key));
    if (attemptedLockedFields.length > 0) {
      return res.status(403).json({
        success: false,
        error: {
          code:          'DATA_LOCKED',
          message:       'These fields are locked after approval. Contact Admin to request a change.',
          locked_fields: attemptedLockedFields
        }
      });
    }
  }
  next();
};
const injectBookingOwnership = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
    });
  }
  const { role, id, transporterId } = req.user;
  req.body.created_by_role = role;
  req.body.created_by_id   = id;
  switch (role) {
    case ROLES.TRANSPORTER:
      req.body.handled_by     = 'transporter';
      req.body.transporter_id = id;
      break;
    case ROLES.AGENT:
      req.body.handled_by     = transporter_id ? 'transporter' : 'admin';
      req.body.transporter_id = transporter_id || null;
      break;
    case ROLES.CUSTOMER:
      req.body.handled_by     = 'admin';
      req.body.transporter_id = null;
      break;
    case ROLES.SUPER_ADMIN:
    case ROLES.OPERATIONS_ADMIN:
      req.body.handled_by     = req.body.transporter_id ? 'transporter' : 'admin';
      break;
    default:
      req.body.handled_by     = 'admin';
      req.body.transporter_id = null;
  }
  next();
};
module.exports = {
  authenticate,
  authorize,
  isAdmin,
  isSuperAdmin,
  isFinanceOrSuper,
  requireCompliance,
  checkDataLock,
  injectBookingOwnership,
  applyScope,
  viewAs,
  auditLogger,
  ROLES,
  ADMIN_ROLES,
  ALL_ROLES,
};