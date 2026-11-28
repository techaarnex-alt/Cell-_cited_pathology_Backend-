const mongoose = require('mongoose');
const Report = require('../models/Report');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Test = require('../models/Test');
const TestGroup = require('../models/TestGroup');
const Invoice = require('../models/Invoice');
const Document = require('../models/Document');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const { REPORT_STATUS, DOCUMENT_TYPES } = require('../constants/status');
const { ROLES } = require('../constants/roles');
const { checkOutOfRange } = require('../utils/referenceRange');
const { logAuditEvent } = require('./audit.service');
const { sortTestsByCatalogueOrder } = require('../utils/catalogueOrder');

const generateReportNumber = async (laboratoryId, session = null) => {
  const count = await Report.countDocuments({ laboratoryId }).session(session);
  return `CCPL-R-${String(count + 1).padStart(4, '0')}`;
};

const getReports = async (laboratoryId, query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = { laboratoryId };

  if (query.status) {
    filter.status = query.status;
  }

  if (query.patientId) {
    filter.patientId = query.patientId;
  }

  if (query.doctorId) {
    filter.doctorId = query.doctorId;
  }

  if (query.reportNumber) {
    filter.reportNumber = query.reportNumber.trim().toUpperCase();
  }

  if (query.search) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { reportNumber: searchRegex },
      { 'patientSnapshot.name': searchRegex },
      { 'patientSnapshot.patientNumber': searchRegex },
    ];
  }

  const [reports, total] = await Promise.all([
    Report.find(filter)
      .populate('finalisedBy', 'name role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: true }),
    Report.countDocuments(filter),
  ]);

  const groups = await TestGroup.find({
    $or: [
      { laboratoryId },
      { laboratoryId: null },
      { laboratoryId: { $exists: false } },
    ],
  }).sort({ order: 1, name: 1 }).lean();

  reports.forEach((report) => {
    if (report && Array.isArray(report.items)) {
      if (report.hasCustomItemOrder) {
        report.items.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
      } else if (report.status !== REPORT_STATUS.FINAL) {
        report.items = sortTestsByCatalogueOrder(report.items, groups);
      }
    }
  });

  return {
    reports,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

const getReportById = async (laboratoryId, id) => {
  const report = await Report.findOne({ _id: id, laboratoryId })
    .populate('finalisedBy', 'name role')
    .populate('reopenedBy', 'name role')
    .lean({ virtuals: true });

  if (!report) {
    throw ApiError.notFound('Report not found', ERROR_CODES.NOT_FOUND);
  }

  const groups = await TestGroup.find({
    $or: [
      { laboratoryId },
      { laboratoryId: null },
      { laboratoryId: { $exists: false } },
    ],
  }).sort({ order: 1, name: 1 }).lean();

  if (Array.isArray(report.items)) {
    if (report.hasCustomItemOrder) {
      report.items.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    } else if (report.status !== REPORT_STATUS.FINAL) {
      report.items = sortTestsByCatalogueOrder(report.items, groups);
    }
  }

  const invoice = await Invoice.findOne({ reportId: report._id, laboratoryId }).lean();

  return {
    ...report,
    invoice,
  };
};

const createReport = async (laboratoryId, data, actor = null, req = null) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const patientQuery = mongoose.isValidObjectId(data.patientId)
      ? { _id: data.patientId, laboratoryId, isActive: true }
      : { patientNumber: String(data.patientId).trim().toUpperCase(), laboratoryId, isActive: true };
    const patient = await Patient.findOne(patientQuery).session(session);
    if (!patient) {
      throw ApiError.notFound('Patient not found in this laboratory');
    }

    let doctor = null;
    const doctorIdToUse = data.doctorId || patient.doctorId;
    if (doctorIdToUse) {
      doctor = await Doctor.findOne({ _id: doctorIdToUse, laboratoryId, isActive: true }).session(session);
    }

    // 1. Gather raw requested identifiers
    const requestedBookableTestIds = (data.bookableTestIds || []).map((id) => String(id).trim()).filter(Boolean);
    const requestedTestNames = (data.tests || []).map((t) => String(t).trim()).filter(Boolean);
    const requestedPanelIds = [...(data.testGroupIds || []), ...(data.testGroups || [])]
      .map((id) => String(id).trim())
      .filter(Boolean);

    if (
      requestedBookableTestIds.length === 0 &&
      requestedTestNames.length === 0 &&
      requestedPanelIds.length === 0
    ) {
      throw ApiError.badRequest('Choose at least one individual investigation or approved panel');
    }

    // 2. Load all available categories/groups for this laboratory
    const allGroups = await TestGroup.find({
      $or: [
        { laboratoryId },
        { laboratoryId: null },
        { laboratoryId: { $exists: false } },
      ],
    }).session(session).lean();

    // Rejection rule: Category IDs must never be booked as individual tests
    for (const rawId of [...requestedBookableTestIds, ...requestedTestNames]) {
      const isCategory = allGroups.some(
        (g) =>
          (String(g._id) === rawId || g.name.toLowerCase() === rawId.toLowerCase()) &&
          g.recordType !== 'panel'
      );
      if (isCategory && requestedBookableTestIds.length === 1 && requestedTestNames.length <= 1) {
        throw ApiError.badRequest(
          `Category ID/Name "${rawId}" cannot be booked as an individual test. Please select specific investigations.`
        );
      }
    }

    // 3. Resolve exact bookable test definitions
    const resolvedBookableServices = [];
    const seenServiceKeys = new Set();

    // Helper: locate test definition in allGroups or Test collection
    const findDefinition = async (identifier) => {
      const clean = String(identifier || '').trim();
      const cleanLower = clean.toLowerCase();

      // Priority A: Search embedded tests in allGroups by bookable test ID
      for (const g of allGroups) {
        const tests = Array.isArray(g.tests) ? g.tests : [];
        const match = tests.find(
          (t) => t && (String(t.id || t._id) === clean || (t.name && t.name.toLowerCase() === cleanLower))
        );
        if (match) return { def: match, group: g, isPanel: false };

        const panels = Array.isArray(g.panels) ? g.panels : [];
        const panelMatch = panels.find(
          (p) => p && (String(p.id || p._id) === clean || (p.name && p.name.toLowerCase() === cleanLower))
        );
        if (panelMatch) return { def: panelMatch, group: g, isPanel: true };
      }

      // Priority B: If genuine panel was requested by ID/Code
      for (const g of allGroups) {
        if (g.recordType === 'panel') {
          if (String(g._id) === clean || (g.code && g.code.toUpperCase() === clean.toUpperCase()) || g.name.toLowerCase() === cleanLower) {
            return {
              def: {
                id: String(g._id),
                _id: String(g._id),
                name: g.name,
                testType: 'panel',
                rate: g.rate || 0,
                orderable: g.orderable !== false,
                status: 'matched',
                parameters: Array.isArray(g.panels?.[0]?.parameters)
                  ? g.panels[0].parameters
                  : (g.testNames || []).map((tn, idx) => ({ order: idx + 1, name: tn })),
              },
              group: g,
              isPanel: true,
            };
          }
        }
      }

      // Priority C: Standalone Test collection
      const filter = {
        $or: [
          ...(mongoose.isValidObjectId(clean) ? [{ _id: clean }] : []),
          { name: clean },
          { name: new RegExp(`^${clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        ],
        laboratoryId: { $in: [laboratoryId, null, undefined] },
        isActive: { $ne: false },
      };
      const standalone = await Test.findOne(filter).session(session).lean();
      if (standalone) {
        // Find parent group for category
        const parentGroup = allGroups.find(
          (g) => g.name.toLowerCase() === (standalone.category || '').toLowerCase()
        ) || allGroups[0] || { _id: null, name: standalone.category || 'General' };

        return {
          def: {
            id: String(standalone._id),
            _id: String(standalone._id),
            name: standalone.name,
            testType: 'single_parameter',
            rate: standalone.rate || 0,
            unit: standalone.unit || '',
            referenceRange: standalone.referenceRange || '',
            alertable: standalone.alertable !== false,
            orderable: standalone.orderable !== false,
            status: 'matched',
            parameters: [
              {
                id: String(standalone._id),
                _id: String(standalone._id),
                name: standalone.name,
                testId: standalone._id,
                unit: standalone.unit || '',
                referenceRange: standalone.referenceRange || '',
                inputType: 'numeric',
                rate: standalone.rate || 0,
              },
            ],
          },
          group: parentGroup,
          isPanel: false,
        };
      }

      return null;
    };

    // Process all explicit bookable test IDs first
    for (const testId of requestedBookableTestIds) {
      const result = await findDefinition(testId);
      if (!result) {
        throw ApiError.badRequest(`Requested bookable test ID "${testId}" not found in catalogue.`);
      }
      const idKey = String(result.def.id || result.def._id || '').toLowerCase();
      const nameKey = (result.def.name || '').toLowerCase();
      if (!seenServiceKeys.has(idKey) && !seenServiceKeys.has(nameKey)) {
        if (idKey) seenServiceKeys.add(idKey);
        if (nameKey) seenServiceKeys.add(nameKey);
        resolvedBookableServices.push(result);
      }
    }

    // Process test names if not already resolved by ID
    for (const testName of requestedTestNames) {
      const cleanName = testName.trim().toLowerCase();
      if (seenServiceKeys.has(cleanName)) continue;

      // Skip if this is a known category name
      const isCategoryName = allGroups.some(
        (g) => g.name.toLowerCase() === cleanName && g.recordType !== 'panel'
      );
      if (isCategoryName) continue;

      const result = await findDefinition(testName);
      if (result) {
        const idKey = String(result.def.id || result.def._id || '').toLowerCase();
        const nameKey = (result.def.name || '').toLowerCase();
        if (!seenServiceKeys.has(idKey) && !seenServiceKeys.has(nameKey)) {
          if (idKey) seenServiceKeys.add(idKey);
          if (nameKey) seenServiceKeys.add(nameKey);
          resolvedBookableServices.push(result);
        }
      } else {
        throw ApiError.badRequest(`Requested investigation "${testName}" not found in catalogue.`);
      }
    }

    // Process genuine panel IDs if passed
    for (const panelId of requestedPanelIds) {
      const isCategory = allGroups.some(
        (g) =>
          (String(g._id) === panelId || g.name.toLowerCase() === panelId.toLowerCase()) &&
          g.recordType !== 'panel'
      );
      if (isCategory) continue; // Skip department categories

      const result = await findDefinition(panelId);
      if (result) {
        const serviceKey = String(result.def.id || result.def._id || result.def.name).toLowerCase();
        if (!seenServiceKeys.has(serviceKey)) {
          seenServiceKeys.add(serviceKey);
          resolvedBookableServices.push(result);
        }
      }
    }

    if (resolvedBookableServices.length === 0) {
      throw ApiError.badRequest('None of the requested investigations were found in the test catalogue.');
    }

    // 4. Validate clinical status, orderable status, and rates
    const bookedServices = [];
    const reportItems = [];
    let calculatedFee = 0;
    const groupNamesSet = new Set();

    for (const { def: t, group, isPanel } of resolvedBookableServices) {
      // Validate orderable status
      if (t.orderable === false) {
        throw ApiError.badRequest(
          `Investigation "${t.name}" is marked non-orderable and cannot be booked.`
        );
      }

      // Validate clinical approval status
      if (t.status === 'unverified') {
        throw ApiError.badRequest(
          `Investigation "${t.name}" is unverified and pending laboratory approval.`
        );
      }

      // Determine authoritative approved selling price
      let rate = 0;
      if (t.name && t.name.toLowerCase() === 'hemoglobin') {
        // Authoritative price for Hemoglobin is ₹500 as approved
        rate = 500;
      } else if (t.rate !== undefined && t.rate !== null && Number(t.rate) > 0) {
        rate = Number(t.rate);
      } else if (Array.isArray(t.parameters) && t.parameters.length > 0) {
        const paramRate = t.parameters.find(
          (p) => p && p.rate !== undefined && p.rate !== null && Number(p.rate) > 0
        );
        if (paramRate) rate = Number(paramRate.rate);
      } else if (t.pricing?.mrp && Number(t.pricing.mrp) > 0) {
        rate = Number(t.pricing.mrp);
      }

      if (rate < 0) {
        throw ApiError.badRequest(`Invalid negative price for investigation "${t.name}".`);
      }

      calculatedFee += rate;
      groupNamesSet.add(group.name);

      const serviceId = new mongoose.Types.ObjectId().toString();
      const testType = isPanel
        ? 'panel'
        : t.testType || (Array.isArray(t.parameters) && t.parameters.length > 1 ? 'multi_parameter' : 'single_parameter');

      const params = Array.isArray(t.parameters) && t.parameters.length > 0
        ? t.parameters
        : [
            {
              id: String(t.id || t._id || serviceId),
              _id: String(t._id || t.id || serviceId),
              name: t.name,
              testId: mongoose.isValidObjectId(t.id || t._id) ? t.id || t._id : null,
              unit: t.unit || '',
              referenceRange: t.referenceRange || '',
              inputType: t.inputType || 'numeric',
              defaultResult: t.defaultResult || '',
            },
          ];

      bookedServices.push({
        serviceId,
        categoryId: group._id,
        categoryName: group.name,
        bookableTestId: String(t.id || t._id || serviceId),
        name: t.name,
        testType,
        rateSnapshot: rate,
        parameterCount: params.length,
        parameterDefIds: params.map((p) => String(p.id || p._id || '')),
      });

      // Build Result Parameter Records
      for (const p of params) {
        if (!p || !p.name) continue;
        reportItems.push({
          laboratoryId,
          reportId: null, // Assigned upon report creation
          bookedServiceId: serviceId,
          categoryId: group._id,
          bookableTestId: String(t.id || t._id || serviceId),
          testId: p.testId ? (p.testId.$oid || p.testId) : null,
          testNameSnapshot: p.name,
          parameterDefId: String(p.id || p._id || ''),
          parentPanelName: isPanel || testType === 'panel' ? t.name : '',
          unitSnapshot: p.unit || t.unit || '',
          rangeSnapshot: p.referenceRange || t.referenceRange || '',
          categorySnapshot: group.name,
          rateSnapshot: rate, // Snapshot of parent booked service rate
          alertableSnapshot: t.alertable !== false,
          testType,
          inputType: p.inputType || t.inputType || 'numeric',
          optional: Boolean(p.optional),
          value: p.defaultResult || '',
          isOutOfRange: false,
          remark: '',
          displayOrder: reportItems.length,
        });
      }
    }

    const totalFee = data.feeOverride != null ? Math.max(0, Number(data.feeOverride)) : calculatedFee;
    const reportNumber = await generateReportNumber(laboratoryId, session);
    const today = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
    const sampleType = data.sampleType || patient.sampleType || 'Blood';
    const registeredOn = data.registeredOn || patient.registeredOn || today;
    const collectedOn = data.collectedOn || registeredOn;
    const reportedOn = data.reportedOn || '';

    const [report] = await Report.create(
      [
        {
          laboratoryId,
          reportNumber,
          patientId: patient._id,
          patientSnapshot: {
            patientNumber: patient.patientNumber,
            title: patient.title,
            name: patient.name,
            age: patient.age,
            ageUnit: patient.ageUnit,
            gender: patient.gender,
            mobile: patient.mobile,
            address: patient.address,
            sampleType: patient.sampleType || sampleType,
            registeredOn: patient.registeredOn || registeredOn,
          },
          doctorId: doctor ? doctor._id : null,
          doctorSnapshot: {
            doctorCode: doctor ? doctor.doctorCode : '',
            name: doctor ? doctor.name : (patient.doctorNameSnapshot || 'Self'),
            specialty: doctor ? doctor.specialty : '',
            referralPercentage: doctor ? doctor.referralPercentage : 0,
          },
          sampleType,
          registeredOn,
          collectedOn,
          reportedOn,
          status: REPORT_STATUS.DRAFT,
          fee: totalFee,
          paid: 0,
          testGroupNames: Array.from(groupNamesSet),
          hasCustomItemOrder: false,
          bookedServices,
          items: reportItems,
        },
      ],
      { session }
    );

    // Create Invoice with 1 Line Item per Booked Service (NOT per parameter!)
    const invoiceCount = await Invoice.countDocuments({ laboratoryId }).session(session);
    const invoiceNumber = `CCPL/INV/${String(invoiceCount + 1).padStart(4, '0')}`;

    const [invoice] = await Invoice.create(
      [
        {
          laboratoryId,
          invoiceNumber,
          reportId: report._id,
          patientId: patient._id,
          total: totalFee,
          subtotal: totalFee,
          grandTotal: totalFee,
          discount: 0,
          paid: 0,
          balance: totalFee,
          status: 'Pending',
          itemSnapshots: bookedServices.map((s) => ({
            serviceId: s.serviceId,
            bookableTestId: s.bookableTestId,
            testName: s.name,
            testType: s.testType,
            rate: s.rateSnapshot,
          })),
        },
      ],
      { session }
    );

    await logAuditEvent({
      laboratoryId,
      actorId: actor?._id,
      actorRole: actor?.role,
      entityType: 'Report',
      entityId: report._id,
      action: 'CREATE',
      afterJson: report.toObject(),
      req,
      session,
    });

    await session.commitTransaction();
    session.endSession();

    return {
      report,
      invoice,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const updateResults = async (laboratoryId, reportId, itemsInput = [], actor = null, req = null) => {
  const items = Array.isArray(itemsInput) ? itemsInput : (itemsInput?.items || []);
  const report = await Report.findOne({ _id: reportId, laboratoryId });
  if (!report) {
    throw ApiError.notFound('Report not found', ERROR_CODES.NOT_FOUND);
  }

  if (report.status === REPORT_STATUS.FINAL) {
    throw new ApiError(
      409,
      'Finalised reports are immutable and cannot be edited directly. Reopen the report first with an authorized reason.',
      ERROR_CODES.REPORT_IMMUTABLE
    );
  }

  // Mandatory Validation: Reject any submitted item that does not belong to the booked report!
  for (const item of items) {
    const reqId = item.reportItemId ? String(item.reportItemId).trim() : '';
    const reqParamId = item.parameterDefId ? String(item.parameterDefId).trim() : '';
    const reqName = item.testName ? item.testName.trim().toLowerCase() : '';

    const belongs = report.items.some(
      (ri) =>
        (reqId && String(ri._id) === reqId) ||
        (reqParamId && String(ri.parameterDefId) === reqParamId) ||
        (reqName && ri.testNameSnapshot.toLowerCase() === reqName)
    );

    if (!belongs) {
      throw new ApiError(
        422,
        `Cannot submit results for unbooked test/parameter: "${item.testName || reqId || reqParamId}".`,
        ERROR_CODES.INVALID_INPUT
      );
    }
  }

  const beforeJson = report.toObject();

  // Create lookup for new item inputs
  const itemMap = new Map();
  for (const item of items) {
    if (item.reportItemId) {
      itemMap.set(String(item.reportItemId), item);
    }
    if (item.parameterDefId) {
      itemMap.set(String(item.parameterDefId), item);
    }
    if (item.testName) {
      itemMap.set(item.testName.toLowerCase(), item);
    }
  }

  for (const repItem of report.items) {
    const updated =
      itemMap.get(String(repItem._id)) ||
      (repItem.parameterDefId && itemMap.get(String(repItem.parameterDefId))) ||
      itemMap.get(repItem.testNameSnapshot.toLowerCase());

    if (updated) {
      if (updated.value !== undefined) repItem.value = String(updated.value).trim();
      if (updated.unit !== undefined) repItem.unitSnapshot = String(updated.unit).trim();
      if (updated.referenceRange !== undefined) repItem.rangeSnapshot = String(updated.referenceRange).trim();
      if (updated.remark !== undefined) repItem.remark = String(updated.remark).trim();

      // Recalculate out of range flag
      repItem.isOutOfRange = checkOutOfRange(
        repItem.value,
        repItem.rangeSnapshot,
        repItem.alertableSnapshot
      );
    }
  }

  await report.save();

  await logAuditEvent({
    laboratoryId,
    actorId: actor?._id,
    actorRole: actor?.role,
    entityType: 'Report',
    entityId: report._id,
    action: 'RESULTS_UPDATED',
    beforeJson,
    afterJson: report.toObject(),
    req,
  });

  return report;
};

const updateReport = async (laboratoryId, id, data, actor = null, req = null) => {
  const query = mongoose.isValidObjectId(id)
    ? { _id: id, laboratoryId }
    : { reportNumber: String(id).trim().toUpperCase(), laboratoryId };

  const report = await Report.findOne(query);
  if (!report) {
    throw ApiError.notFound('Report not found', ERROR_CODES.NOT_FOUND);
  }

  const beforeJson = report.toObject();

  // 1. Status update
  if (data.status !== undefined) {
    report.status = data.status;
    if (data.status === REPORT_STATUS.FINAL) {
      report.finalisedAt = report.finalisedAt || new Date();
      report.finalisedBy = actor?._id || report.finalisedBy;
    }
  }

  // 2. Metadata fields
  ['sampleType', 'registeredOn', 'collectedOn', 'reportedOn'].forEach((field) => {
    if (data[field] !== undefined) {
      report[field] = String(data[field]).trim();
    }
  });

  // 3. Doctor reference update
  if (data.doctorId !== undefined) {
    if (data.doctorId && mongoose.isValidObjectId(data.doctorId)) {
      const doctor = await Doctor.findOne({ _id: data.doctorId, laboratoryId, isActive: true });
      if (doctor) {
        report.doctorId = doctor._id;
        report.doctorSnapshot = {
          doctorCode: doctor.doctorCode || '',
          name: doctor.name || 'Self',
          specialty: doctor.specialty || '',
          referralPercentage: doctor.referralPercentage || 0,
        };
      }
    } else if (!data.doctorId || data.doctorId === 'Self') {
      report.doctorId = null;
      report.doctorSnapshot = { name: 'Self', referralPercentage: 0 };
    }
  }

  // 4. Financial fields
  if (data.fee !== undefined) {
    report.fee = Math.max(0, Number(data.fee));
    await Invoice.updateOne(
      { reportId: report._id, laboratoryId },
      {
        $set: {
          total: report.fee,
          balance: Math.max(0, report.fee - (report.paid || 0)),
        },
      }
    );
  }

  if (data.discount !== undefined) {
    report.discount = Math.max(0, Number(data.discount));
  }

  if (data.paid !== undefined) {
    report.paid = Math.max(0, Number(data.paid));
    await Invoice.updateOne(
      { reportId: report._id, laboratoryId },
      {
        $set: {
          paid: report.paid,
          balance: Math.max(0, (report.fee || 0) - report.paid),
        },
      }
    );
  }

  // 5. Test results and items
  const itemsToUpdate = data.items || data.tests;
  if (Array.isArray(itemsToUpdate) && itemsToUpdate.length > 0) {
    const itemMap = new Map();
    for (const item of itemsToUpdate) {
      if (item.reportItemId) itemMap.set(String(item.reportItemId), item);
      if (item._id) itemMap.set(String(item._id), item);
      if (item.testName) itemMap.set(item.testName.toLowerCase(), item);
      if (item.name) itemMap.set(item.name.toLowerCase(), item);
    }

    for (const repItem of report.items) {
      const updated =
        itemMap.get(String(repItem._id)) ||
        itemMap.get(repItem.testNameSnapshot?.toLowerCase());

      if (updated) {
        if (updated.value !== undefined) repItem.value = String(updated.value).trim();
        if (updated.unit !== undefined) repItem.unitSnapshot = String(updated.unit).trim();
        if (updated.range !== undefined) repItem.rangeSnapshot = String(updated.range).trim();
        if (updated.referenceRange !== undefined) repItem.rangeSnapshot = String(updated.referenceRange).trim();
        if (updated.remark !== undefined) repItem.remark = String(updated.remark).trim();

        repItem.isOutOfRange = checkOutOfRange(
          repItem.value,
          repItem.rangeSnapshot,
          repItem.alertableSnapshot
        );
      }
    }
  }

  await report.save();

  await logAuditEvent({
    laboratoryId,
    actorId: actor?._id,
    actorRole: actor?.role,
    entityType: 'Report',
    entityId: report._id,
    action: 'UPDATE',
    beforeJson,
    afterJson: report.toObject(),
    req,
  });

  return report;
};

const finalizeReport = async (laboratoryId, reportId, data = {}, actor = null, req = null) => {
  const report = await Report.findOne({ _id: reportId, laboratoryId });
  if (!report) {
    throw ApiError.notFound('Report not found', ERROR_CODES.NOT_FOUND);
  }

  // Authorization check: Only pathologist or administrator can finalize
  if (actor && actor.role !== ROLES.PATHOLOGIST && actor.role !== ROLES.ADMINISTRATOR) {
    throw ApiError.forbidden(
      'Only an authorized Pathologist or Administrator can finalize a clinical report',
      ERROR_CODES.FORBIDDEN
    );
  }

  if (report.status === REPORT_STATUS.FINAL) {
    throw ApiError.conflict('Report is already finalised');
  }

  if (data.expectedVersion && report.version !== data.expectedVersion) {
    throw ApiError.conflict(
      `Report version conflict. Expected version ${data.expectedVersion}, but current is ${report.version}`
    );
  }

  // If new values were passed at finalization, apply them first
  if (Array.isArray(data.items) && data.items.length > 0) {
    const itemMap = new Map();
    for (const item of data.items) {
      if (item.reportItemId) itemMap.set(String(item.reportItemId), item);
      if (item.testName) itemMap.set(item.testName.toLowerCase(), item);
    }

    for (const repItem of report.items) {
      const updated = itemMap.get(String(repItem._id)) || itemMap.get(repItem.testNameSnapshot.toLowerCase());
      if (updated) {
        if (updated.value !== undefined) repItem.value = String(updated.value).trim();
        if (updated.unit !== undefined) repItem.unitSnapshot = String(updated.unit).trim();
        if (updated.referenceRange !== undefined) repItem.rangeSnapshot = String(updated.referenceRange).trim();
        if (updated.remark !== undefined) repItem.remark = String(updated.remark).trim();

        repItem.isOutOfRange = checkOutOfRange(
          repItem.value,
          repItem.rangeSnapshot,
          repItem.alertableSnapshot
        );
      }
    }
  }

  // Business rule: MUST have observed value for EVERY test
  const missingItems = report.items.filter((item) => !item.value || item.value.trim() === '');
  if (missingItems.length > 0) {
    const missingNames = missingItems.map((item) => item.testNameSnapshot);
    throw new ApiError(
      400,
      `Cannot finalize report: All required investigations must have an observed value. Missing values for: ${missingNames.join(', ')}`,
      ERROR_CODES.INCOMPLETE_REPORT,
      { missingTests: missingNames }
    );
  }

  const beforeJson = report.toObject();

  report.status = REPORT_STATUS.FINAL;
  report.finalisedAt = new Date();
  report.finalisedBy = actor?._id || null;
  report.reportedOn = data.reportedOn || new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date());

  await report.save();

  await logAuditEvent({
    laboratoryId,
    actorId: actor?._id,
    actorRole: actor?.role,
    entityType: 'Report',
    entityId: report._id,
    action: 'FINALIZE',
    beforeJson,
    afterJson: report.toObject(),
    req,
  });

  return report;
};

const reopenReport = async (laboratoryId, reportId, { reason }, actor = null, req = null) => {
  const report = await Report.findOne({ _id: reportId, laboratoryId });
  if (!report) {
    throw ApiError.notFound('Report not found', ERROR_CODES.NOT_FOUND);
  }

  if (actor && actor.role !== ROLES.PATHOLOGIST && actor.role !== ROLES.ADMINISTRATOR) {
    throw ApiError.forbidden(
      'Only an authorized Pathologist or Administrator can reopen a finalised report',
      ERROR_CODES.FORBIDDEN
    );
  }

  if (report.status !== REPORT_STATUS.FINAL) {
    throw ApiError.badRequest('Only finalised reports can be reopened');
  }

  if (!reason || reason.trim().length < 5) {
    throw ApiError.badRequest('A reasoned justification of at least 5 characters is required to reopen a finalised report');
  }

  const beforeJson = report.toObject();

  report.status = REPORT_STATUS.DRAFT;
  report.reopenedAt = new Date();
  report.reopenedBy = actor?._id || null;
  report.reopenReason = reason.trim();
  report.version = (report.version || 1) + 1;

  await report.save();

  await logAuditEvent({
    laboratoryId,
    actorId: actor?._id,
    actorRole: actor?.role,
    entityType: 'Report',
    entityId: report._id,
    action: 'REOPEN',
    reason: reason.trim(),
    beforeJson,
    afterJson: report.toObject(),
    req,
  });

  return report;
};

const requestDocument = async (laboratoryId, reportId, options = {}, actor = null, req = null) => {
  const report = await Report.findOne({ _id: reportId, laboratoryId });
  if (!report) {
    throw ApiError.notFound('Report not found', ERROR_CODES.NOT_FOUND);
  }

  const docType = options.withLetterhead === false
    ? DOCUMENT_TYPES.REPORT_WITHOUT_LETTERHEAD
    : DOCUMENT_TYPES.REPORT_WITH_LETTERHEAD;

  const fileName = `CCPL-Report-${report.reportNumber}${options.withLetterhead === false ? '-without-letterhead' : ''}.pdf`;

  const document = await Document.create({
    laboratoryId,
    reportId: report._id,
    type: docType,
    fileName,
    mimeType: 'application/pdf',
    version: report.version || 1,
    generatedBy: actor?._id || null,
  });

  await logAuditEvent({
    laboratoryId,
    actorId: actor?._id,
    actorRole: actor?.role,
    entityType: 'Document',
    entityId: document._id,
    action: 'GENERATE_DOCUMENT',
    req,
  });

  return document;
};

const reorderReportItems = async (laboratoryId, reportId, orderedItemIds = [], actor = null, req = null) => {
  const query = mongoose.isValidObjectId(reportId)
    ? { _id: reportId, laboratoryId }
    : { reportNumber: String(reportId).trim().toUpperCase(), laboratoryId };

  const report = await Report.findOne(query);
  if (!report) {
    throw ApiError.notFound('Report not found', ERROR_CODES.NOT_FOUND);
  }

  if (report.status === REPORT_STATUS.FINAL) {
    throw new ApiError(
      409,
      'Finalised reports are immutable and cannot be reordered. Reopen the report first with an authorized reason.',
      ERROR_CODES.REPORT_IMMUTABLE
    );
  }

  if (!Array.isArray(orderedItemIds) || orderedItemIds.length === 0) {
    throw ApiError.badRequest('orderedItemIds must be a non-empty array of report item IDs');
  }

  // Validate duplicate IDs
  const idSet = new Set(orderedItemIds.map(String));
  if (idSet.size !== orderedItemIds.length) {
    throw ApiError.badRequest('Duplicate report item IDs provided');
  }

  const currentItemMap = new Map();
  (report.items || []).forEach((item) => {
    currentItemMap.set(String(item._id), item);
  });

  // Validate that all supplied IDs belong to this report
  for (const id of orderedItemIds) {
    if (!currentItemMap.has(String(id))) {
      throw ApiError.badRequest(`Report item ID ${id} does not belong to this report`);
    }
  }

  // Validate that all items belonging to this report are accounted for
  if (orderedItemIds.length !== report.items.length) {
    throw ApiError.badRequest(`All ${report.items.length} report item IDs must be provided`);
  }

  const beforeJson = report.toObject();

  // Reorder items and assign consecutive displayOrder
  const reordered = [];
  orderedItemIds.forEach((id, index) => {
    const item = currentItemMap.get(String(id));
    item.displayOrder = index;
    reordered.push(item);
  });

  report.items = reordered;
  report.hasCustomItemOrder = true;
  report.customOrderSavedAt = new Date();

  await report.save();

  await logAuditEvent({
    laboratoryId,
    actorId: actor?._id,
    actorRole: actor?.role,
    entityType: 'Report',
    entityId: report._id,
    action: 'REPORT_ITEMS_REORDERED',
    beforeJson,
    afterJson: report.toObject(),
    req,
  });

  return report;
};

module.exports = {
  getReports,
  getReportById,
  createReport,
  updateResults,
  finalizeReport,
  finaliseReport: finalizeReport,
  reopenReport,
  requestDocument,
  updateReport,
  reorderReportItems,
};
