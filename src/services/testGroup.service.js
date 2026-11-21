const TestGroup = require('../models/TestGroup');
const Test = require('../models/Test');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const { logAuditEvent } = require('./audit.service');

const getTestGroups = async (laboratoryId) => {
  const groups = await TestGroup.find({ laboratoryId, isActive: true })
    .populate('testIds', 'name category unit referenceRange rate alertable')
    .sort({ name: 1 })
    .lean();

  return groups;
};

const createTestGroup = async (laboratoryId, data, actor = null, req = null) => {
  const existing = await TestGroup.findOne({
    laboratoryId,
    $or: [{ code: data.code.trim().toUpperCase() }, { name: data.name.trim() }],
    isActive: true,
  });

  if (existing) {
    throw ApiError.conflict('A test group with this code or name already exists');
  }

  let testIds = [];
  let testNames = data.testNames || [];

  if (testNames.length > 0) {
    const tests = await Test.find({
      laboratoryId,
      name: { $in: testNames },
      isActive: true,
    }).select('_id name');

    testIds = tests.map((t) => t._id);
    testNames = tests.map((t) => t.name);
  }

  const group = await TestGroup.create({
    laboratoryId,
    code: data.code.trim().toUpperCase(),
    name: data.name.trim(),
    description: data.description ? data.description.trim() : '',
    category: data.category ? data.category.trim() : 'General',
    testIds,
    testNames,
  });

  await logAuditEvent({
    laboratoryId,
    actorId: actor?._id,
    actorRole: actor?.role,
    entityType: 'TestGroup',
    entityId: group._id,
    action: 'CREATE',
    afterJson: group.toObject(),
    req,
  });

  return group;
};

module.exports = {
  getTestGroups,
  createTestGroup,
};
