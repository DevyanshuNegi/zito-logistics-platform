const RESERVED_DETAIL_KEYS = new Set([
  'entity_type',
  'entity_id',
  'old_value',
  'new_value',
  'before',
  'after',
]);

const ENTITY_KEY_PRIORITY = [
  'scan_id',
  'offer_id',
  'payment_id',
  'trip_charge_id',
  'inventory_record_id',
  'storage_booking_id',
  'warehouse_space_id',
  'contract_id',
  'complaint_id',
  'booking_id',
  'vehicle_id',
  'driver_id',
  'user_id',
];

const normalizeAuditValue = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeAuditValue(item))
      .filter((item) => item !== undefined);
  }
  if (typeof value === 'object') {
    return Object.entries(value).reduce((accumulator, [key, nestedValue]) => {
      const normalized = normalizeAuditValue(nestedValue);
      if (normalized !== undefined) {
        accumulator[key] = normalized;
      }
      return accumulator;
    }, {});
  }
  return value;
};

const getUserRole = (user) => {
  if (!user) return null;
  if (Array.isArray(user.roles) && user.roles.length > 0) return user.roles[0];
  return user.role || null;
};

const inferAuditEntity = (details = {}) => {
  if (details.entity_type && details.entity_id) {
    return {
      entityType: String(details.entity_type),
      entityId: String(details.entity_id),
    };
  }

  for (const key of ENTITY_KEY_PRIORITY) {
    if (details[key]) {
      return {
        entityType: key.replace(/_id$/, ''),
        entityId: String(details[key]),
      };
    }
  }

  const fallbackEntry = Object.entries(details).find(([key, value]) => (
    key.endsWith('_id')
    && !['created_by', 'updated_by', 'deleted_by', 'responded_by', 'target_user'].includes(key)
    && value
  ));

  if (fallbackEntry) {
    return {
      entityType: fallbackEntry[0].replace(/_id$/, ''),
      entityId: String(fallbackEntry[1]),
    };
  }

  return {
    entityType: 'system',
    entityId: 'global',
  };
};

const buildAuditSnapshot = (details = {}) => {
  const explicitNewValue = details.new_value ?? details.after;
  if (explicitNewValue !== undefined) {
    return normalizeAuditValue(explicitNewValue);
  }

  return normalizeAuditValue(
    Object.entries(details).reduce((accumulator, [key, value]) => {
      if (!RESERVED_DETAIL_KEYS.has(key)) {
        accumulator[key] = value;
      }
      return accumulator;
    }, {}),
  );
};

const buildAuditLogData = (req, action, details = {}) => {
  const actor = req.adminUser || req.user || null;
  const actingAs = req.viewAs ? getUserRole(req.adminUser) : getUserRole(req.user);
  const { entityType, entityId } = inferAuditEntity(details);

  return {
    userId: actor?.id || null,
    actingAs: actingAs || getUserRole(actor),
    action,
    entityType,
    entityId,
    oldValue: normalizeAuditValue(details.old_value ?? details.before ?? null),
    newValue: buildAuditSnapshot({
      ...details,
      _meta: {
        request_method: req.method,
        request_path: req.originalUrl,
        recorded_at: new Date().toISOString(),
        actor_role: actingAs || getUserRole(actor),
        view_as_user_id: req.viewAs ? req.user?.id : null,
      },
    }),
    ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
    userAgent: req.headers['user-agent'] || null,
  };
};

module.exports = {
  buildAuditLogData,
  inferAuditEntity,
  normalizeAuditValue,
};
