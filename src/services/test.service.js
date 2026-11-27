const mongoose = require('mongoose');
const Test = require('../models/Test');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const { logAuditEvent } = require('./audit.service');

const normalizeTest = (t) => {
  if (!t) return t;
  const name = t.name || t.investigation || '';
  const code = t.code || t.testCode || '';
  const rate = t.rate !== undefined && t.rate !== null
    ? Number(t.rate)
    : (t.pricing?.mrp !== undefined ? Number(t.pricing.mrp) : (t.pricing?.net !== undefined ? Number(t.pricing.net) : 0));

  return {
    ...t,
    name,
    investigation: t.investigation || name,
    code,
    testCode: t.testCode || code,
    rate,
    category: t.category || 'General',
    unit: t.unit || '',
    referenceRange: t.referenceRange || '',
    alertable: t.alertable !== false,
    isActive: t.isActive !== false,
  };
};

const getTests = async (laboratoryId, query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(2000, Math.max(1, parseInt(query.limit, 10) || 100));
  const skip = (page - 1) * limit;

  const filter = {
    $or: [
      { laboratoryId },
      { laboratoryId: null },
      { laboratoryId: { $exists: false } },
    ],
    isActive: { $ne: false },
  };

  const andConditions = [];

  if (query.search) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    andConditions.push({
      $or: [
        { name: searchRegex },
        { investigation: searchRegex },
        { code: searchRegex },
        { testCode: searchRegex },
        { category: searchRegex },
        { unit: searchRegex },
        { method: searchRegex },
        { sampleInstructions: searchRegex },
      ],
    });
  }

  if (query.category) {
    andConditions.push({
      category: new RegExp(`^${query.category.trim()}$`, 'i'),
    });
  }

  if (andConditions.length > 0) {
    filter.$and = andConditions;
  }

  const [rawTests, total] = await Promise.all([
    Test.find(filter)
      .sort({ category: 1, name: 1, investigation: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Test.countDocuments(filter),
  ]);

  const tests = rawTests.map(normalizeTest);

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
    ? {
        _id: id,
        $or: [{ laboratoryId }, { laboratoryId: null }, { laboratoryId: { $exists: false } }],
        isActive: { $ne: false },
      }
    : {
        $or: [
          { name: new RegExp(`^${String(id).trim()}$`, 'i') },
          { investigation: new RegExp(`^${String(id).trim()}$`, 'i') },
          { code: new RegExp(`^${String(id).trim()}$`, 'i') },
          { testCode: new RegExp(`^${String(id).trim()}$`, 'i') },
        ],
        $or: [{ laboratoryId }, { laboratoryId: null }, { laboratoryId: { $exists: false } }],
        isActive: { $ne: false },
      };

  const test = await Test.findOne(query).lean();
  if (!test) {
    throw ApiError.notFound('Test not found', ERROR_CODES.NOT_FOUND);
  }
  return normalizeTest(test);
};

const createTest = async (laboratoryId, data, actor = null, req = null) => {
  const testName = (data.name || data.investigation || '').trim();
  const testCode = (data.code || data.testCode || '').trim().toUpperCase();

  const existing = await Test.findOne({
    laboratoryId,
    $or: [
      { name: new RegExp(`^${testName}$`, 'i') },
      { investigation: new RegExp(`^${testName}$`, 'i') },
      ...(testCode ? [{ code: testCode }, { testCode }] : []),
    ],
  });

  if (existing && existing.isActive) {
    throw ApiError.conflict('A test with this name or code already exists in the catalogue');
  }

  if (existing && !existing.isActive) {
    existing.isActive = true;
    existing.code = testCode || existing.code;
    existing.testCode = testCode || existing.testCode;
    existing.name = testName || existing.name;
    existing.investigation = testName || existing.investigation;
    existing.category = data.category ? data.category.trim() : existing.category;
    existing.unit = data.unit ? data.unit.trim() : existing.unit;
    existing.referenceRange = data.referenceRange || data.range || existing.referenceRange;
    existing.rate = Number(data.rate ?? (data.pricing?.mrp || existing.rate || 0));
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

    return normalizeTest(existing.toObject());
  }

  const rate = Number(data.rate ?? (data.pricing?.mrp || data.pricing?.net || 0));

  const test = await Test.create({
    laboratoryId,
    code: testCode,
    testCode,
    name: testName,
    investigation: testName,
    category: data.category ? data.category.trim() : 'General',
    unit: data.unit ? data.unit.trim() : '',
    referenceRange: data.referenceRange || data.range || '',
    rate,
    pricing: {
      net: rate,
      mrp: rate,
      currency: 'INR',
    },
    sampleInstructions: data.sampleInstructions || '',
    temperature: data.temperature || '',
    method: data.method || '',
    cutoffTime: data.cutoffTime || '',
    reportingTime: data.reportingTime || '',
    alertable: data.alertable !== false,
    isActive: true,
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

  return normalizeTest(test.toObject());
};

const updateTest = async (laboratoryId, id, data, actor = null, req = null) => {
  const query = mongoose.isValidObjectId(id)
    ? { _id: id, laboratoryId, isActive: true }
    : {
        $or: [
          { name: new RegExp(`^${String(id).trim()}$`, 'i') },
          { investigation: new RegExp(`^${String(id).trim()}$`, 'i') },
        ],
        laboratoryId,
        isActive: true,
      };

  let test = await Test.findOne(query);
  if (!test) {
    return createTest(laboratoryId, { ...data, name: data.name || id }, actor, req);
  }

  const beforeJson = test.toObject();

  const newName = (data.name || data.investigation || '').trim();
  if (newName && newName.toLowerCase() !== (test.name || '').toLowerCase()) {
    const existing = await Test.findOne({
      laboratoryId,
      $or: [
        { name: new RegExp(`^${newName}$`, 'i') },
        { investigation: new RegExp(`^${newName}$`, 'i') },
      ],
      isActive: true,
      _id: { $ne: test._id },
    });
    if (existing) {
      throw ApiError.conflict('Another test already exists with this name');
    }
  }

  if (data.code !== undefined || data.testCode !== undefined) {
    const codeVal = (data.code || data.testCode || '').trim().toUpperCase();
    test.code = codeVal;
    test.testCode = codeVal;
  }

  if (data.name !== undefined || data.investigation !== undefined) {
    const nameVal = (data.name || data.investigation || '').trim();
    test.name = nameVal;
    test.investigation = nameVal;
  }

  if (data.category !== undefined) test.category = data.category.trim();
  if (data.unit !== undefined) test.unit = data.unit.trim();
  if (data.referenceRange !== undefined || data.range !== undefined) {
    test.referenceRange = (data.referenceRange || data.range || '').trim();
  }

  if (data.rate !== undefined || data.pricing?.mrp !== undefined) {
    const rateVal = Number(data.rate ?? (data.pricing?.mrp || 0));
    test.rate = rateVal;
    test.pricing = {
      ...(test.pricing || {}),
      mrp: rateVal,
      net: rateVal,
      currency: 'INR',
    };
  }

  ['alertable', 'isActive', 'sampleInstructions', 'temperature', 'method', 'cutoffTime', 'reportingTime'].forEach((field) => {
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

  return normalizeTest(test.toObject());
};

const deleteTest = async (laboratoryId, id, actor = null, req = null) => {
  const query = mongoose.isValidObjectId(id)
    ? { _id: id, laboratoryId, isActive: true }
    : {
        $or: [
          { name: new RegExp(`^${String(id).trim()}$`, 'i') },
          { investigation: new RegExp(`^${String(id).trim()}$`, 'i') },
        ],
        laboratoryId,
        isActive: true,
      };

  const test = await Test.findOne(query);
  if (!test) {
    return { message: 'Test successfully retired from catalogue' };
  }

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
