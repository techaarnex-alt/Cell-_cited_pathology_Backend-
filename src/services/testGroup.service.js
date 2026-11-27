const TestGroup = require('../models/TestGroup');
const Test = require('../models/Test');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const { logAuditEvent } = require('./audit.service');

const getTestGroups = async (laboratoryId) => {
  const filter = {};
  if (laboratoryId) {
    filter.$or = [
      { laboratoryId },
      { laboratoryId: null },
      { laboratoryId: { $exists: false } },
    ];
  }

  // Do not filter out isActive: false so imported catalogs/groups are immediately returned
  const rawGroups = await TestGroup.find(filter)
    .populate('testIds', 'name category unit referenceRange rate alertable')
    .sort({ order: 1, name: 1 })
    .lean();

  const groups = rawGroups.map((group) => {
    const derivedTestNames = [];
    const derivedTestIds = [];

    // Extract tests from the rich nested "tests" array if present
    if (Array.isArray(group.tests)) {
      group.tests.forEach((t) => {
        if (t && typeof t === 'object') {
          if (t.name && !derivedTestNames.includes(t.name)) {
            derivedTestNames.push(t.name);
          }
          if (Array.isArray(t.parameters)) {
            t.parameters.forEach((p) => {
              if (p && p.name && !derivedTestNames.includes(p.name)) {
                derivedTestNames.push(p.name);
              }
              if (p && p.testId) {
                derivedTestIds.push(p.testId);
              }
            });
          }
        } else if (typeof t === 'string' && !derivedTestNames.includes(t)) {
          derivedTestNames.push(t);
        }
      });
    }

    // Extract from "panels" if present
    if (Array.isArray(group.panels)) {
      group.panels.forEach((p) => {
        if (p && typeof p === 'object') {
          if (p.name && !derivedTestNames.includes(p.name)) {
            derivedTestNames.push(p.name);
          }
          if (Array.isArray(p.parameters)) {
            p.parameters.forEach((param) => {
              if (param && param.name && !derivedTestNames.includes(param.name)) {
                derivedTestNames.push(param.name);
              }
            });
          }
        }
      });
    }

    return {
      ...group,
      testNames:
        group.testNames && group.testNames.length > 0
          ? group.testNames
          : derivedTestNames,
      testIds:
        group.testIds && group.testIds.length > 0
          ? group.testIds
          : derivedTestIds,
      isActive: group.isActive !== false,
    };
  });

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
