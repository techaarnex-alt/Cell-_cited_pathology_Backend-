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

    const requestedGroupIds = [...(data.testGroupIds || []), ...(data.testGroups || [])];
    const requestedTestIds = [...(data.testIds || []), ...(data.tests || [])];

    if (requestedGroupIds.length === 0 && requestedTestIds.length === 0) {
      throw ApiError.badRequest('Choose at least one test group or individual investigation');
    }

    // Resolve groups
    const groups = await TestGroup.find({
      laboratoryId,
      $or: [
        { _id: { $in: requestedGroupIds.filter((id) => mongoose.isValidObjectId(id)) } },
        { code: { $in: requestedGroupIds } },
        { name: { $in: requestedGroupIds } },
      ],
      isActive: true,
    }).session(session);

    const groupTestNames = new Set(groups.flatMap((g) => g.testNames || []));
    const groupNames = groups.map((g) => g.name);

    // Find tests
    const testFilters = [
      { name: { $in: [...groupTestNames] } },
      { name: { $in: requestedTestIds } },
    ];
    const validObjectIds = requestedTestIds.filter((id) => mongoose.isValidObjectId(id));
    if (validObjectIds.length > 0) {
      testFilters.push({ _id: { $in: validObjectIds } });
    }

    const catalogueTests = await Test.find({
      laboratoryId,
      $or: testFilters,
      isActive: true,
    }).session(session);

    if (catalogueTests.length === 0) {
      throw ApiError.badRequest('None of the requested investigations were found in the test catalogue');
    }

    // Deduplicate and snapshot
    const seenNames = new Set();
    const reportItems = [];
    let calculatedFee = 0;

    for (const test of catalogueTests) {
      const key = test.name.toLowerCase();
      if (!seenNames.has(key)) {
        seenNames.add(key);
        reportItems.push({
          laboratoryId,
          testId: test._id,
          testNameSnapshot: test.name,
          unitSnapshot: test.unit || '',
          rangeSnapshot: test.referenceRange || '',
          categorySnapshot: test.category || 'General',
          rateSnapshot: test.rate || 0,
          alertableSnapshot: test.alertable !== false,
          value: '',
          isOutOfRange: false,
          remark: '',
          displayOrder: reportItems.length,
        });
        calculatedFee += Number(test.rate || 0);
      }
    }

    const totalFee = data.feeOverride != null ? Number(data.feeOverride) : calculatedFee;
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
          testGroupNames: groupNames,
          items: reportItems,
        },
      ],
      { session }
    );

    // Create Invoice shell
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
          paid: 0,
          balance: totalFee,
          status: 'Pending',
          itemSnapshots: reportItems.map((item) => ({
            testName: item.testNameSnapshot,
            rate: item.rateSnapshot,
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

const updateResults = async (laboratoryId, reportId, items = [], actor = null, req = null) => {
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

  const beforeJson = report.toObject();

  // Create lookup for new item inputs
  const itemMap = new Map();
  for (const item of items) {
    if (item.reportItemId) {
      itemMap.set(String(item.reportItemId), item);
    }
    if (item.testName) {
      itemMap.set(item.testName.toLowerCase(), item);
    }
  }

  for (const repItem of report.items) {
    const updated = itemMap.get(String(repItem._id)) || itemMap.get(repItem.testNameSnapshot.toLowerCase());
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

module.exports = {
  getReports,
  getReportById,
  createReport,
  updateResults,
  finalizeReport,
  reopenReport,
  requestDocument,
};
