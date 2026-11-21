const mongoose = require('mongoose');
const Test = require('../models/Test');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const { logAuditEvent } = require('./audit.service');

const getTests = async (laboratoryId, query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 100));
  const skip = (page - 1) * limit;

  const filter = { laboratoryId, isActive: true };

  if (query.search) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { name: searchRegex },
      { category: searchRegex },
      { unit: searchRegex },
    ];
  }

  if (query.category) {
    filter.category = query.category.trim();
  }

  const [tests, total] = await Promise.all([
    Test.find(filter)
      .sort({ category: 1, name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Test.countDocuments(filter),
  ]);

  return {
    tests,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

const getTestById = async (laboratoryId, id) => {
  const query = mongoose.isValidObjectId(id)
    ? { _id: id, laboratoryId, isActive: true }
    : { name: new RegExp(`^${String(id).trim()}$`, 'i'), laboratoryId, isActive: true };
  const test = await Test.findOne(query).lean();
  if (!test) {
    throw ApiError.notFound('Test not found', ERROR_CODES.NOT_FOUND);
  }
  return test;
};

const createTest = async (laboratoryId, data, actor = null, req = null) => {
  const existing = await Test.findOne({
    laboratoryId,
    name: new RegExp(`^${data.name.trim()}$`, 'i'),
  });

  if (existing && existing.isActive) {
    throw ApiError.conflict('A test with this name already exists in the catalogue');
  }

  if (existing && !existing.isActive) {
    existing.isActive = true;
    existing.code = data.code ? data.code.trim().toUpperCase() : existing.code;
    existing.category = data.category ? data.category.trim() : existing.category;
    existing.unit = data.unit ? data.unit.trim() : existing.unit;
    existing.referenceRange = data.referenceRange ? data.referenceRange.trim() : existing.referenceRange;
    existing.rate = Number(data.rate ?? existing.rate ?? 0);
    existing.alertable = data.alertable !== false;
    existing.version = (existing.version || 1) + 1;
    await existing.save();

    await logAuditEvent({
      laboratoryId,
      actorId: actor?._id,
      actorRole: actor?.role,
      entityType: 'Test',
      entityId: existing._id,
      action: 'UPDATE',
      afterJson: existing.toObject(),
      reason: 'Reactivated previously retired test',
      req,
    });

    return existing;
  }

  const test = await Test.create({
    laboratoryId,
    code: data.code ? data.code.trim().toUpperCase() : '',
    name: data.name.trim(),
    category: data.category ? data.category.trim() : 'General',
    unit: data.unit ? data.unit.trim() : '',
    referenceRange: data.referenceRange ? data.referenceRange.trim() : '',
    rate: Number(data.rate || 0),
    alertable: data.alertable !== false,
  });

  await logAuditEvent({
    laboratoryId,
    actorId: actor?._id,
    actorRole: actor?.role,
    entityType: 'Test',
    entityId: test._id,
    action: 'CREATE',
    afterJson: test.toObject(),
    req,
  });

  return test;
};

const updateTest = async (laboratoryId, id, data, actor = null, req = null) => {
  const query = mongoose.isValidObjectId(id)
    ? { _id: id, laboratoryId, isActive: true }
    : { name: new RegExp(`^${String(id).trim()}$`, 'i'), laboratoryId, isActive: true };
  let test = await Test.findOne(query);
  if (!test) {
    // If not found in DB (e.g. curated item not yet persisted), create it with the updated values
    return createTest(
      laboratoryId,
      {
        name: data.name || id,
        category: data.category || 'General',
        unit: data.unit || '',
        referenceRange: data.referenceRange || '',
        rate: Number(data.rate || 0),
        alertable: data.alertable !== false,
      },
      actor,
      req
    );
  }

  const beforeJson = test.toObject();

  if (data.name && data.name.trim().toLowerCase() !== test.name.toLowerCase()) {
    const existing = await Test.findOne({
      laboratoryId,
      name: new RegExp(`^${data.name.trim()}$`, 'i'),
      isActive: true,
      _id: { $ne: test._id },
    });
    if (existing) {
      throw ApiError.conflict('Another test already exists with this name');
    }
  }

  ['code', 'name', 'category', 'unit', 'referenceRange', 'rate', 'alertable', 'isActive'].forEach((field) => {
    if (data[field] !== undefined) {
      test[field] = data[field];
    }
  });

  test.version = (test.version || 1) + 1;
  await test.save();

  await logAuditEvent({
    laboratoryId,
    actorId: actor?._id,
    actorRole: actor?.role,
    entityType: 'Test',
    entityId: test._id,
    action: 'UPDATE',
    beforeJson,
    afterJson: test.toObject(),
    req,
  });

  return test;
};

const deleteTest = async (laboratoryId, id, actor = null, req = null) => {
  const query = mongoose.isValidObjectId(id)
    ? { _id: id, laboratoryId, isActive: true }
    : { name: new RegExp(`^${String(id).trim()}$`, 'i'), laboratoryId, isActive: true };
  const test = await Test.findOne(query);
  if (!test) {
    return { message: 'Test successfully retired from catalogue' };
  }

  // Soft delete to protect historical integrity
  test.isActive = false;
  await test.save();

  await logAuditEvent({
    laboratoryId,
    actorId: actor?._id,
    actorRole: actor?.role,
    entityType: 'Test',
    entityId: test._id,
    action: 'DELETE',
    reason: 'Retired / soft-deleted from active catalogue',
    req,
  });

  return { message: 'Test successfully retired from catalogue' };
};

module.exports = {
  getTests,
  getTestById,
  createTest,
  updateTest,
  deleteTest,
};
