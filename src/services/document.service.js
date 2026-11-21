const Document = require('../models/Document');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const { logAuditEvent } = require('./audit.service');

const getDocumentById = async (laboratoryId, id, actor = null, req = null) => {
  const document = await Document.findOne({ _id: id, laboratoryId });
  if (!document) {
    throw ApiError.notFound('Document not found', ERROR_CODES.NOT_FOUND);
  }

  document.downloadCount = (document.downloadCount || 0) + 1;
  document.lastDownloadedAt = new Date();
  await document.save();

  await logAuditEvent({
    laboratoryId,
    actorId: actor?._id,
    actorRole: actor?.role,
    entityType: 'Document',
    entityId: document._id,
    action: 'DOWNLOAD',
    req,
  });

  return document;
};

module.exports = {
  getDocumentById,
};
