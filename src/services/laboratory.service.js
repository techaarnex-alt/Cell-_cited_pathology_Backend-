const Laboratory = require('../models/Laboratory');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const { logAuditEvent } = require('./audit.service');

const getLaboratoryProfile = async (laboratoryId) => {
  let lab = await Laboratory.findById(laboratoryId).lean();
  if (!lab) {
    lab = await Laboratory.findOne({ code: 'CCPL' }).lean();
  }
  if (!lab) {
    throw ApiError.notFound('Laboratory profile not found', ERROR_CODES.NOT_FOUND);
  }
  return lab;
};

const updateLaboratoryProfile = async (laboratoryId, data, actor = null, req = null) => {
  let lab = await Laboratory.findById(laboratoryId);
  if (!lab) {
    lab = await Laboratory.findOne({ code: 'CCPL' });
  }
  if (!lab) {
    throw ApiError.notFound('Laboratory profile not found', ERROR_CODES.NOT_FOUND);
  }

  const beforeJson = lab.toObject();

  const allowedFields = [
    'name',
    'address',
    'phones',
    'email',
    'medicalCertificate',
    'authorisedSignatory',
    'registrationDetails',
    'letterheadAssetUrl',
    'watermarkAssetUrl',
    'timezone',
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      lab[field] = data[field];
    }
  }

  await lab.save();

  await logAuditEvent({
    laboratoryId: lab._id,
    actorId: actor?._id,
    actorRole: actor?.role,
    entityType: 'Laboratory',
    entityId: lab._id,
    action: 'UPDATE',
    beforeJson,
    afterJson: lab.toObject(),
    req,
  });

  return lab;
};

module.exports = {
  getLaboratoryProfile,
  updateLaboratoryProfile,
};
