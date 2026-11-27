const mongoose = require('mongoose');
const TestGroup = require('../models/TestGroup');
const Test = require('../models/Test');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const { logAuditEvent } = require('./audit.service');

const REQUIRED_CATEGORIES = [
  'Haematology',
  'Biochemistry',
  'Serology & Immunology',
  'Clinical Pathology',
  'Cytology',
  'Microbiology',
  'Endocrinology',
  'Histopathology',
  'Others',
  'Miscellaneous',
];

const buildLabFilter = (laboratoryId, extra = {}) => {
  const filter = { ...extra };
  if (laboratoryId) {
    filter.$or = [
      { laboratoryId },
      { laboratoryId: null },
      { laboratoryId: { $exists: false } },
    ];
  }
  return filter;
};

/**
 * Get all 10 categories with dynamic counts
 * Clearly distinguishing individual parameter counts from grouped catalogue test counts
 */
const getCategories = async (laboratoryId) => {
  const groups = await TestGroup.find(buildLabFilter(laboratoryId))
    .sort({ order: 1, name: 1 })
    .lean();

  // Also count individual tests from 'tests' collection by category
  const individualTestCounts = await Test.aggregate([
    {
      $match: {
        ...(laboratoryId ? {
          $or: [
            { laboratoryId },
            { laboratoryId: null },
            { laboratoryId: { $exists: false } },
          ],
        } : {}),
      },
    },
    {
      $group: {
        _id: '$category',
        total: { $sum: 1 },
        active: {
          $sum: {
            $cond: [{ $ne: ['$isActive', false] }, 1, 0],
          },
        },
      },
    },
  ]);

  const individualMap = {};
  individualTestCounts.forEach((item) => {
    if (item._id) individualMap[item._id] = item;
  });

  let totalCatalogueTests = 0;
  let totalNestedParameters = 0;
  let totalPanels = 0;
  let totalIndividualTests = 0;

  const categories = groups.map((g, idx) => {
    const tests = Array.isArray(g.tests) ? g.tests : [];
    const panels = Array.isArray(g.panels) ? g.panels : [];
    
    let paramCount = 0;
    tests.forEach((t) => {
      if (t && Array.isArray(t.parameters)) {
        paramCount += t.parameters.length;
      }
    });

    const indCount = individualMap[g.name] || { total: 0, active: 0 };

    totalCatalogueTests += tests.length;
    totalNestedParameters += paramCount;
    totalPanels += panels.length;
    totalIndividualTests += indCount.total;

    return {
      _id: g._id,
      id: String(g._id),
      name: g.name,
      order: g.order !== undefined ? g.order : idx + 1,
      labSmartCategoryId: g.labSmartCategoryId || null,
      catalogueTestCount: tests.length,
      nestedParameterCount: paramCount,
      panelCount: panels.length,
      individualTestCount: indCount.total,
      individualActiveCount: indCount.active,
      isActive: g.isActive !== false,
    };
  });

  return {
    categories,
    totals: {
      catalogueTests: totalCatalogueTests,
      nestedParameters: totalNestedParameters,
      panels: totalPanels,
      individualTests: totalIndividualTests,
    },
  };
};

/**
 * Get tests for a specific category or All categories
 */
const getCategoryTests = async (laboratoryId, categoryName, query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = query.limit !== undefined ? Math.max(0, parseInt(query.limit, 10)) : 25; // 0 means show all
  const search = (query.search || '').trim().toLowerCase();
  const testTypeFilter = (query.testType || '').trim().toLowerCase();
  const statusFilter = (query.status || '').trim().toLowerCase();

  const isAll = !categoryName || categoryName === 'All';
  const groupFilter = buildLabFilter(laboratoryId);
  if (!isAll) {
    groupFilter.name = new RegExp(`^${categoryName.trim()}$`, 'i');
  }

  const groups = await TestGroup.find(groupFilter)
    .sort({ order: 1, name: 1 })
    .lean();

  let allTests = [];

  groups.forEach((group) => {
    const tests = Array.isArray(group.tests) ? group.tests : [];
    tests.forEach((t) => {
      if (!t) return;
      allTests.push({
        ...t,
        id: String(t.id || t._id || ''),
        _id: String(t._id || t.id || ''),
        category: group.name,
        categoryId: String(group._id),
        categoryOrder: group.order || 0,
        parameterCount: Array.isArray(t.parameters) ? t.parameters.length : 0,
        status: t.status || 'active',
        isActive: t.isActive !== false && t.status !== 'inactive',
      });
    });
  });

  // Filter by search
  if (search) {
    allTests = allTests.filter((t) => {
      const name = (t.name || '').toLowerCase();
      const shortName = (t.shortName || '').toLowerCase();
      const code = (t.code || '').toLowerCase();
      const cat = (t.category || '').toLowerCase();
      const unit = (t.unit || '').toLowerCase();
      const paramMatches = Array.isArray(t.parameters) && t.parameters.some((p) =>
        (p.name || '').toLowerCase().includes(search)
      );

      return (
        name.includes(search) ||
        shortName.includes(search) ||
        code.includes(search) ||
        cat.includes(search) ||
        unit.includes(search) ||
        paramMatches
      );
    });
  }

  // Filter by testType
  if (testTypeFilter && testTypeFilter !== 'all') {
    allTests = allTests.filter((t) => (t.testType || '').toLowerCase() === testTypeFilter);
  }

  // Filter by status
  if (statusFilter && statusFilter !== 'all') {
    allTests = allTests.filter((t) => (t.status || '').toLowerCase() === statusFilter);
  }

  // Sort by order within category, then category order
  allTests.sort((a, b) => {
    if (a.categoryOrder !== b.categoryOrder) {
      return a.categoryOrder - b.categoryOrder;
    }
    return (a.order || 0) - (b.order || 0);
  });

  const totalItems = allTests.length;
  let paginatedTests = allTests;

  if (limit > 0) {
    const skip = (page - 1) * limit;
    paginatedTests = allTests.slice(skip, skip + limit);
  }

  return {
    tests: paginatedTests,
    pagination: {
      page,
      limit,
      total: totalItems,
      pages: limit > 0 ? Math.ceil(totalItems / limit) : 1,
    },
  };
};

/**
 * Get single test details by testId, with populated parameters from `tests`
 */
const getTestById = async (laboratoryId, testId) => {
  if (!testId) {
    throw ApiError.badRequest('Test ID is required');
  }

  const groups = await TestGroup.find(buildLabFilter(laboratoryId)).lean();

  let foundTest = null;
  let foundGroup = null;

  for (const group of groups) {
    const tests = Array.isArray(group.tests) ? group.tests : [];
    const t = tests.find(
      (item) => String(item.id || item._id) === String(testId)
    );
    if (t) {
      foundTest = t;
      foundGroup = group;
      break;
    }
  }

  if (!foundTest) {
    throw ApiError.notFound('Test not found in catalogue');
  }

  // Populate parameter links from `tests` collection
  const parameters = Array.isArray(foundTest.parameters) ? [...foundTest.parameters] : [];
  const testIdsToFetch = parameters
    .map((p) => p.testId ? (p.testId.$oid || p.testId) : null)
    .filter((id) => id && mongoose.isValidObjectId(id));

  let linkedTestsMap = new Map();
  if (testIdsToFetch.length > 0) {
    const linkedRecords = await Test.find({ _id: { $in: testIdsToFetch } }).lean();
    linkedRecords.forEach((rec) => {
      linkedTestsMap.set(String(rec._id), rec);
    });
  }

  const populatedParameters = parameters.map((p, idx) => {
    const linkedId = p.testId ? String(p.testId.$oid || p.testId) : null;
    const linkedDoc = linkedId ? linkedTestsMap.get(linkedId) : null;

    return {
      id: String(p.id || p._id || idx + 1),
      _id: String(p._id || p.id || idx + 1),
      order: p.order !== undefined ? p.order : idx + 1,
      name: p.name || linkedDoc?.name || '',
      testId: linkedId,
      status: p.status || (linkedDoc ? 'linked' : 'unlinked'),
      unit: p.unit || linkedDoc?.unit || '',
      referenceRange: p.referenceRange || linkedDoc?.referenceRange || '',
      rate: p.rate !== undefined ? p.rate : (linkedDoc?.rate || 0),
      defaultResult: p.defaultResult || '',
      inputType: p.inputType || 'numeric',
      optional: Boolean(p.optional),
      linkedDetails: linkedDoc || null,
    };
  });

  return {
    ...foundTest,
    id: String(foundTest.id || foundTest._id),
    _id: String(foundTest._id || foundTest.id),
    category: foundGroup.name,
    categoryId: String(foundGroup._id),
    categoryOrder: foundGroup.order,
    parameters: populatedParameters,
    parameterCount: populatedParameters.length,
  };
};

/**
 * Create a new test in a specific category
 */
const createTest = async (laboratoryId, categoryName, testData, user = null, req = null) => {
  const group = await TestGroup.findOne(
    buildLabFilter(laboratoryId, { name: new RegExp(`^${categoryName.trim()}$`, 'i') })
  );

  if (!group) {
    throw ApiError.notFound(`Category '${categoryName}' not found`);
  }

  const existingTests = Array.isArray(group.tests) ? group.tests : [];
  
  // Calculate next order
  const maxOrder = existingTests.reduce((max, t) => Math.max(max, t.order || 0), 0);
  const newId = new mongoose.Types.ObjectId().toString();

  const formattedParameters = (testData.parameters || []).map((p, idx) => ({
    id: p.id || new mongoose.Types.ObjectId().toString(),
    _id: p._id || new mongoose.Types.ObjectId().toString(),
    order: p.order !== undefined ? p.order : idx + 1,
    name: p.name || '',
    testId: p.testId ? (mongoose.isValidObjectId(p.testId) ? new mongoose.Types.ObjectId(p.testId) : p.testId) : null,
    unit: p.unit || '',
    referenceRange: p.referenceRange || '',
    defaultResult: p.defaultResult || '',
    inputType: p.inputType || 'numeric',
    rate: Number(p.rate) || 0,
    optional: Boolean(p.optional),
    status: p.status || 'active',
  }));

  const newTest = {
    id: newId,
    _id: newId,
    order: testData.order !== undefined ? Number(testData.order) : maxOrder + 1,
    name: (testData.name || '').trim(),
    shortName: (testData.shortName || '').trim(),
    code: (testData.code || '').trim().toUpperCase(),
    testType: testData.testType || (formattedParameters.length > 1 ? 'multi_parameter' : 'single_parameter'),
    unit: testData.unit || '',
    inputType: testData.inputType || 'numeric',
    defaultResult: testData.defaultResult || '',
    referenceRange: testData.referenceRange || '',
    rate: Number(testData.rate) || 0,
    optional: Boolean(testData.optional),
    alertable: testData.alertable !== false,
    status: testData.status || 'active',
    orderable: testData.orderable !== false,
    note: testData.note || '',
    source: testData.source || 'user_entry',
    parameters: formattedParameters,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  group.tests.push(newTest);
  await group.save();

  const targetLabId = laboratoryId || group.laboratoryId;
  if (targetLabId) {
    await logAuditEvent({
      laboratoryId: targetLabId,
      actorId: user?._id,
      actorRole: user?.role,
      entityType: 'CATALOGUE_TEST',
      entityId: newId,
      action: 'CREATE',
      afterJson: newTest,
      reason: `Created test '${newTest.name}' in '${categoryName}'`,
      req,
    });
  }

  return {
    ...newTest,
    category: group.name,
    categoryId: String(group._id),
  };
};

/**
 * Update an existing test in the catalogue
 */
const updateTest = async (laboratoryId, testId, updateData, user = null, req = null) => {
  const groups = await TestGroup.find(buildLabFilter(laboratoryId));

  let sourceGroup = null;
  let testIndex = -1;

  for (const group of groups) {
    const tests = Array.isArray(group.tests) ? group.tests : [];
    const idx = tests.findIndex(
      (item) => String(item.id || item._id) === String(testId)
    );
    if (idx !== -1) {
      sourceGroup = group;
      testIndex = idx;
      break;
    }
  }

  if (!sourceGroup || testIndex === -1) {
    throw ApiError.notFound('Test not found in catalogue');
  }

  const existingTest = sourceGroup.tests[testIndex];
  const targetCategoryName = updateData.category ? updateData.category.trim() : sourceGroup.name;
  const isMovingCategory = targetCategoryName.toLowerCase() !== sourceGroup.name.toLowerCase();

  // Prepare updated test object
  const formattedParameters = Array.isArray(updateData.parameters)
    ? updateData.parameters.map((p, idx) => ({
        id: String(p.id || p._id || new mongoose.Types.ObjectId()),
        _id: String(p._id || p.id || new mongoose.Types.ObjectId()),
        order: p.order !== undefined ? p.order : idx + 1,
        name: p.name || '',
        testId: p.testId ? (mongoose.isValidObjectId(p.testId) ? new mongoose.Types.ObjectId(p.testId) : p.testId) : null,
        unit: p.unit || '',
        referenceRange: p.referenceRange || '',
        defaultResult: p.defaultResult || '',
        inputType: p.inputType || 'numeric',
        rate: Number(p.rate) || 0,
        optional: Boolean(p.optional),
        status: p.status || 'active',
      }))
    : existingTest.parameters;

  const updatedTest = {
    ...existingTest,
    ...updateData,
    id: String(existingTest.id || existingTest._id),
    _id: String(existingTest._id || existingTest.id),
    name: updateData.name !== undefined ? updateData.name.trim() : existingTest.name,
    shortName: updateData.shortName !== undefined ? updateData.shortName.trim() : existingTest.shortName,
    code: updateData.code !== undefined ? updateData.code.trim().toUpperCase() : existingTest.code,
    testType: updateData.testType || existingTest.testType,
    unit: updateData.unit !== undefined ? updateData.unit : existingTest.unit,
    inputType: updateData.inputType || existingTest.inputType || 'numeric',
    defaultResult: updateData.defaultResult !== undefined ? updateData.defaultResult : existingTest.defaultResult,
    referenceRange: updateData.referenceRange !== undefined ? updateData.referenceRange : existingTest.referenceRange,
    rate: updateData.rate !== undefined ? Number(updateData.rate) : existingTest.rate,
    optional: updateData.optional !== undefined ? Boolean(updateData.optional) : existingTest.optional,
    alertable: updateData.alertable !== undefined ? Boolean(updateData.alertable) : existingTest.alertable,
    status: updateData.status || existingTest.status || 'active',
    orderable: updateData.orderable !== undefined ? Boolean(updateData.orderable) : existingTest.orderable,
    order: updateData.order !== undefined ? Number(updateData.order) : existingTest.order,
    note: updateData.note !== undefined ? updateData.note : existingTest.note,
    parameters: formattedParameters,
    updatedAt: new Date(),
  };

  if (isMovingCategory) {
    // Remove from source group
    sourceGroup.tests.splice(testIndex, 1);
    await sourceGroup.save();

    // Add to target group
    const targetGroup = await TestGroup.findOne(
      buildLabFilter(laboratoryId, { name: new RegExp(`^${targetCategoryName}$`, 'i') })
    );

    if (!targetGroup) {
      throw ApiError.notFound(`Target category '${targetCategoryName}' not found`);
    }

    const maxOrder = (targetGroup.tests || []).reduce((max, t) => Math.max(max, t.order || 0), 0);
    updatedTest.order = maxOrder + 1;
    targetGroup.tests.push(updatedTest);
    await targetGroup.save();

    const targetLabId = laboratoryId || sourceGroup.laboratoryId;
    if (targetLabId) {
      await logAuditEvent({
        laboratoryId: targetLabId,
        actorId: user?._id,
        actorRole: user?.role,
        entityType: 'CATALOGUE_TEST',
        entityId: testId,
        action: 'MOVE_CATEGORY',
        beforeJson: { category: sourceGroup.name },
        afterJson: { category: targetGroup.name },
        reason: `Moved test '${updatedTest.name}' from '${sourceGroup.name}' to '${targetGroup.name}'`,
        req,
      });
    }

    return {
      ...updatedTest,
      category: targetGroup.name,
      categoryId: String(targetGroup._id),
    };
  } else {
    sourceGroup.tests[testIndex] = updatedTest;
    await sourceGroup.save();

    const targetLabId = laboratoryId || sourceGroup.laboratoryId;
    if (targetLabId) {
      await logAuditEvent({
        laboratoryId: targetLabId,
        actorId: user?._id,
        actorRole: user?.role,
        entityType: 'CATALOGUE_TEST',
        entityId: testId,
        action: 'UPDATE',
        beforeJson: existingTest,
        afterJson: updatedTest,
        reason: `Updated test '${updatedTest.name}'`,
        req,
      });
    }

    return {
      ...updatedTest,
      category: sourceGroup.name,
      categoryId: String(sourceGroup._id),
    };
  }
};

/**
 * Delete / retire a test from catalogue
 */
const deleteTest = async (laboratoryId, testId, user = null, req = null) => {
  const groups = await TestGroup.find(buildLabFilter(laboratoryId));

  let sourceGroup = null;
  let testIndex = -1;

  for (const group of groups) {
    const tests = Array.isArray(group.tests) ? group.tests : [];
    const idx = tests.findIndex(
      (item) => String(item.id || item._id) === String(testId)
    );
    if (idx !== -1) {
      sourceGroup = group;
      testIndex = idx;
      break;
    }
  }

  if (!sourceGroup || testIndex === -1) {
    throw ApiError.notFound('Test not found in catalogue');
  }

  const removed = sourceGroup.tests.splice(testIndex, 1)[0];
  await sourceGroup.save();

  const targetLabId = laboratoryId || sourceGroup.laboratoryId;
  if (targetLabId) {
    await logAuditEvent({
      laboratoryId: targetLabId,
      actorId: user?._id,
      actorRole: user?.role,
      entityType: 'CATALOGUE_TEST',
      entityId: testId,
      action: 'DELETE',
      beforeJson: removed,
      reason: `Deleted test '${removed.name}' from '${sourceGroup.name}'`,
      req,
    });
  }

  return { success: true, removedTestId: testId };
};

/**
 * 3-Level Reordering:
 * Level 1: Category reordering
 */
const reorderCategories = async (laboratoryId, orderedCategoryNames) => {
  if (!Array.isArray(orderedCategoryNames)) {
    throw ApiError.badRequest('orderedCategoryNames must be an array of category names');
  }

  const groups = await TestGroup.find(buildLabFilter(laboratoryId));
  const updates = [];

  for (let i = 0; i < orderedCategoryNames.length; i++) {
    const catName = orderedCategoryNames[i];
    const group = groups.find((g) => g.name.toLowerCase() === catName.toLowerCase());
    if (group) {
      group.order = i + 1;
      updates.push(group.save());
    }
  }

  await Promise.all(updates);
  return getCategories(laboratoryId);
};

/**
 * 3-Level Reordering:
 * Level 2: Test reordering within a category
 */
const reorderCategoryTests = async (laboratoryId, categoryName, orderedTestIds) => {
  if (!Array.isArray(orderedTestIds)) {
    throw ApiError.badRequest('orderedTestIds must be an array of test IDs');
  }

  const group = await TestGroup.findOne(
    buildLabFilter(laboratoryId, { name: new RegExp(`^${categoryName.trim()}$`, 'i') })
  );

  if (!group) {
    throw ApiError.notFound(`Category '${categoryName}' not found`);
  }

  const tests = Array.isArray(group.tests) ? group.tests : [];
  const testMap = new Map();
  tests.forEach((t) => {
    testMap.set(String(t.id || t._id), t);
  });

  const reordered = [];
  let currentOrder = 1;

  // Place tests in provided order
  orderedTestIds.forEach((id) => {
    const t = testMap.get(String(id));
    if (t) {
      t.order = currentOrder++;
      reordered.push(t);
      testMap.delete(String(id));
    }
  });

  // Append any remaining tests not in orderedTestIds
  testMap.forEach((t) => {
    t.order = currentOrder++;
    reordered.push(t);
  });

  group.tests = reordered;
  await group.save();

  return getCategoryTests(laboratoryId, categoryName, { limit: 0 });
};

/**
 * 3-Level Reordering:
 * Level 3: Parameter reordering within a test
 */
const reorderTestParameters = async (laboratoryId, testId, orderedParamIds) => {
  if (!Array.isArray(orderedParamIds)) {
    throw ApiError.badRequest('orderedParamIds must be an array of parameter IDs');
  }

  const groups = await TestGroup.find(buildLabFilter(laboratoryId));
  let targetGroup = null;
  let targetTest = null;

  for (const group of groups) {
    const tests = Array.isArray(group.tests) ? group.tests : [];
    const t = tests.find((item) => String(item.id || item._id) === String(testId));
    if (t) {
      targetGroup = group;
      targetTest = t;
      break;
    }
  }

  if (!targetGroup || !targetTest) {
    throw ApiError.notFound('Test not found in catalogue');
  }

  const params = Array.isArray(targetTest.parameters) ? targetTest.parameters : [];
  const paramMap = new Map();
  params.forEach((p) => {
    paramMap.set(String(p.id || p._id), p);
  });

  const reorderedParams = [];
  let currentOrder = 1;

  orderedParamIds.forEach((id) => {
    const p = paramMap.get(String(id));
    if (p) {
      p.order = currentOrder++;
      reorderedParams.push(p);
      paramMap.delete(String(id));
    }
  });

  paramMap.forEach((p) => {
    p.order = currentOrder++;
    reorderedParams.push(p);
  });

  targetTest.parameters = reorderedParams;
  await targetGroup.save();

  return getTestById(laboratoryId, testId);
};

/**
 * Add parameter to test
 */
const addParameter = async (laboratoryId, testId, paramData) => {
  const groups = await TestGroup.find(buildLabFilter(laboratoryId));
  let targetGroup = null;
  let targetTest = null;

  for (const group of groups) {
    const tests = Array.isArray(group.tests) ? group.tests : [];
    const t = tests.find((item) => String(item.id || item._id) === String(testId));
    if (t) {
      targetGroup = group;
      targetTest = t;
      break;
    }
  }

  if (!targetGroup || !targetTest) {
    throw ApiError.notFound('Test not found in catalogue');
  }

  const params = Array.isArray(targetTest.parameters) ? targetTest.parameters : [];
  const maxOrder = params.reduce((max, p) => Math.max(max, p.order || 0), 0);
  const newParamId = new mongoose.Types.ObjectId().toString();

  const newParam = {
    id: newParamId,
    _id: newParamId,
    order: paramData.order !== undefined ? Number(paramData.order) : maxOrder + 1,
    name: (paramData.name || '').trim(),
    testId: paramData.testId ? (mongoose.isValidObjectId(paramData.testId) ? new mongoose.Types.ObjectId(paramData.testId) : paramData.testId) : null,
    unit: paramData.unit || '',
    referenceRange: paramData.referenceRange || '',
    defaultResult: paramData.defaultResult || '',
    inputType: paramData.inputType || 'numeric',
    rate: Number(paramData.rate) || 0,
    optional: Boolean(paramData.optional),
    status: paramData.status || 'active',
  };

  params.push(newParam);
  targetTest.parameters = params;
  if (params.length > 1 && targetTest.testType === 'single_parameter') {
    targetTest.testType = 'multi_parameter';
  }

  await targetGroup.save();
  return getTestById(laboratoryId, testId);
};

/**
 * Update parameter in test
 */
const updateParameter = async (laboratoryId, testId, paramId, paramData) => {
  const groups = await TestGroup.find(buildLabFilter(laboratoryId));
  let targetGroup = null;
  let targetTest = null;

  for (const group of groups) {
    const tests = Array.isArray(group.tests) ? group.tests : [];
    const t = tests.find((item) => String(item.id || item._id) === String(testId));
    if (t) {
      targetGroup = group;
      targetTest = t;
      break;
    }
  }

  if (!targetGroup || !targetTest) {
    throw ApiError.notFound('Test not found in catalogue');
  }

  const params = Array.isArray(targetTest.parameters) ? targetTest.parameters : [];
  const paramIdx = params.findIndex((p) => String(p.id || p._id) === String(paramId));
  if (paramIdx === -1) {
    throw ApiError.notFound('Parameter not found in test');
  }

  const existingParam = params[paramIdx];
  params[paramIdx] = {
    ...existingParam,
    ...paramData,
    id: String(existingParam.id || existingParam._id),
    _id: String(existingParam._id || existingParam.id),
    name: paramData.name !== undefined ? paramData.name.trim() : existingParam.name,
    testId: paramData.testId !== undefined ? (paramData.testId && mongoose.isValidObjectId(paramData.testId) ? new mongoose.Types.ObjectId(paramData.testId) : paramData.testId) : existingParam.testId,
    unit: paramData.unit !== undefined ? paramData.unit : existingParam.unit,
    referenceRange: paramData.referenceRange !== undefined ? paramData.referenceRange : existingParam.referenceRange,
    defaultResult: paramData.defaultResult !== undefined ? paramData.defaultResult : existingParam.defaultResult,
    inputType: paramData.inputType || existingParam.inputType || 'numeric',
    rate: paramData.rate !== undefined ? Number(paramData.rate) : existingParam.rate,
    optional: paramData.optional !== undefined ? Boolean(paramData.optional) : existingParam.optional,
    status: paramData.status || existingParam.status || 'active',
    order: paramData.order !== undefined ? Number(paramData.order) : existingParam.order,
  };

  targetTest.parameters = params;
  await targetGroup.save();
  return getTestById(laboratoryId, testId);
};

/**
 * Remove parameter from test
 */
const removeParameter = async (laboratoryId, testId, paramId) => {
  const groups = await TestGroup.find(buildLabFilter(laboratoryId));
  let targetGroup = null;
  let targetTest = null;

  for (const group of groups) {
    const tests = Array.isArray(group.tests) ? group.tests : [];
    const t = tests.find((item) => String(item.id || item._id) === String(testId));
    if (t) {
      targetGroup = group;
      targetTest = t;
      break;
    }
  }

  if (!targetGroup || !targetTest) {
    throw ApiError.notFound('Test not found in catalogue');
  }

  const params = Array.isArray(targetTest.parameters) ? targetTest.parameters : [];
  targetTest.parameters = params.filter((p) => String(p.id || p._id) !== String(paramId));

  await targetGroup.save();
  return getTestById(laboratoryId, testId);
};

module.exports = {
  REQUIRED_CATEGORIES,
  getCategories,
  getCategoryTests,
  getTestById,
  createTest,
  updateTest,
  deleteTest,
  reorderCategories,
  reorderCategoryTests,
  reorderTestParameters,
  addParameter,
  updateParameter,
  removeParameter,
};
