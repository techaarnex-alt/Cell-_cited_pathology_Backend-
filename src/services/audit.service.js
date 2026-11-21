const AuditEvent = require('../models/AuditEvent');
const logger = require('../utils/logger');

const logAuditEvent = async ({
  laboratoryId,
  actorId = null,
  actorRole = '',
  entityType,
  entityId,
  action,
  beforeJson = null,
  afterJson = null,
  reason = '',
  req = null,
  session = null,
}) => {
  try {
    const ipAddress = req ? req.ip || req.headers['x-forwarded-for'] || '' : '';
    const requestId = req ? req.id || '' : '';

    const auditData = {
      laboratoryId,
      actorId: actorId || (req?.user?._id ?? null),
      actorRole: actorRole || (req?.user?.role ?? ''),
      entityType,
      entityId: String(entityId),
      action: action.toUpperCase(),
      beforeJson,
      afterJson,
      reason,
      ipAddress,
      requestId,
      occurredAt: new Date(),
    };

    if (session) {
      await AuditEvent.create([auditData], { session });
    } else {
      await AuditEvent.create(auditData);
    }
  } catch (error) {
    logger.error(`Failed to record audit event for ${entityType} ${entityId}:`, error);
  }
};

module.exports = {
  logAuditEvent,
};
