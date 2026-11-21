const mongoose = require('mongoose');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Test = require('../models/Test');
const TestGroup = require('../models/TestGroup');
const Report = require('../models/Report');
const Invoice = require('../models/Invoice');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const { logAuditEvent } = require('./audit.service');

const generatePatientNumber = async (laboratoryId, session = null) => {
  const count = await Patient.countDocuments({ laboratoryId }).session(session);
  return `CCPL-${String(count + 1).padStart(4, '0')}`;
};

const getPatients = async (laboratoryId, query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = { laboratoryId, isActive: true };

  if (query.search) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { name: searchRegex },
      { patientNumber: searchRegex },
      { mobile: searchRegex },
    ];
  }

  if (query.patientNumber) {
    filter.patientNumber = query.patientNumber.trim().toUpperCase();
  }

  if (query.mobile) {
    filter.mobile = query.mobile.trim();
  }

  const [patients, total] = await Promise.all([
    Patient.find(filter)
      .populate('doctorId', 'doctorCode name specialty referralPercentage')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Patient.countDocuments(filter),
  ]);

  return {
    patients,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

const getPatientById = async (laboratoryId, id) => {
  const query = mongoose.isValidObjectId(id)
    ? { _id: id, laboratoryId, isActive: true }
    : { patientNumber: String(id).trim().toUpperCase(), laboratoryId, isActive: true };
  const patient = await Patient.findOne(query)
    .populate('doctorId', 'doctorCode name specialty referralPercentage')
    .lean();

  if (!patient) {
    throw ApiError.notFound('Patient not found', ERROR_CODES.NOT_FOUND);
  }

  const reports = await Report.find({
    laboratoryId,
    $or: [{ patientId: patient._id }, { 'patientSnapshot.patientNumber': patient.patientNumber }],
  })
    .sort({ createdAt: -1 })
    .select('reportNumber status fee paid testGroupNames createdAt reportedOn')
    .lean();

  return {
    ...patient,
    reports,
  };
};

const createPatient = async (laboratoryId, data, actor = null, req = null) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let doctor = null;
    let doctorNameSnapshot = 'Self';

    if (data.doctorId) {
      doctor = await Doctor.findOne({ _id: data.doctorId, laboratoryId, isActive: true }).session(session);
      if (doctor) {
        doctorNameSnapshot = doctor.name;
      }
    }

    const patientNumber = await generatePatientNumber(laboratoryId, session);
    const today = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
    const registeredOn = data.registeredOn || today;
    const collectedOn = data.collectedOn || registeredOn;
    const reportedOn = data.reportedOn || '';
    const sampleType = data.sampleType || 'Blood';

    const [patient] = await Patient.create(
      [
        {
          laboratoryId,
          patientNumber,
          title: data.title || '',
          name: data.name.trim(),
          age: data.age,
          ageUnit: data.ageUnit || 'Years',
          gender: data.gender,
          mobile: data.mobile ? data.mobile.trim() : '',
          address: data.address ? data.address.trim() : '',
          doctorId: doctor ? doctor._id : null,
          doctorNameSnapshot,
          sampleType,
          registeredOn,
        },
      ],
      { session }
    );

    let createdReport = null;
    const requestedGroupIds = [...(data.testGroupIds || []), ...(data.testGroups || [])];
    const requestedTestIds = [...(data.testIds || []), ...(data.tests || [])];

    if (requestedGroupIds.length > 0 || requestedTestIds.length > 0) {
      // Resolve groups
      const groups = await TestGroup.find({
        laboratoryId,
        $or: [{ _id: { $in: requestedGroupIds.filter((id) => mongoose.isValidObjectId(id)) } }, { code: { $in: requestedGroupIds } }, { name: { $in: requestedGroupIds } }],
        isActive: true,
      }).session(session);

      const groupTestNames = new Set(groups.flatMap((g) => g.testNames || []));
      const groupNames = groups.map((g) => g.name);

      // Find all tests (by ID, by name, or from groups)
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

      // Deduplicate selected tests
      const seenTestNames = new Set();
      const reportItems = [];
      let totalFee = 0;

      for (const t of catalogueTests) {
        if (!seenTestNames.has(t.name.toLowerCase())) {
          seenTestNames.add(t.name.toLowerCase());
          reportItems.push({
            laboratoryId,
            testId: t._id,
            testNameSnapshot: t.name,
            unitSnapshot: t.unit || '',
            rangeSnapshot: t.referenceRange || '',
            categorySnapshot: t.category || 'General',
            rateSnapshot: t.rate || 0,
            alertableSnapshot: t.alertable !== false,
            value: '',
            isOutOfRange: false,
            remark: '',
            displayOrder: reportItems.length,
          });
          totalFee += Number(t.rate || 0);
        }
      }

      if (reportItems.length > 0) {
        const reportCount = await Report.countDocuments({ laboratoryId }).session(session);
        const reportNumber = `CCPL-R-${String(reportCount + 1).padStart(4, '0')}`;
        const finalFee = data.feeOverride != null ? Number(data.feeOverride) : totalFee;

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
                sampleType,
                registeredOn,
              },
              doctorId: doctor ? doctor._id : null,
              doctorSnapshot: {
                doctorCode: doctor ? doctor.doctorCode : '',
                name: doctor ? doctor.name : 'Self',
                specialty: doctor ? doctor.specialty : '',
                referralPercentage: doctor ? doctor.referralPercentage : 0,
              },
              sampleType,
              registeredOn,
              collectedOn,
              reportedOn,
              status: 'Draft',
              fee: finalFee,
              paid: 0,
              testGroupNames: groupNames,
              items: reportItems,
            },
          ],
          { session }
        );

        // Generate invoice shell
        const invoiceCount = await Invoice.countDocuments({ laboratoryId }).session(session);
        const invoiceNumber = `CCPL/INV/${String(invoiceCount + 1).padStart(4, '0')}`;

        await Invoice.create(
          [
            {
              laboratoryId,
              invoiceNumber,
              reportId: report._id,
              patientId: patient._id,
              total: finalFee,
              paid: 0,
              balance: finalFee,
              status: 'Pending',
              itemSnapshots: reportItems.map((item) => ({
                testName: item.testNameSnapshot,
                rate: item.rateSnapshot,
              })),
            },
          ],
          { session }
        );

        createdReport = report;
      }
    }

    await logAuditEvent({
      laboratoryId,
      actorId: actor?._id,
      actorRole: actor?.role,
      entityType: 'Patient',
      entityId: patient._id,
      action: 'CREATE',
      afterJson: patient.toObject(),
      req,
      session,
    });

    await session.commitTransaction();
    session.endSession();

    return {
      patient,
      report: createdReport,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const updatePatient = async (laboratoryId, id, data, actor = null, req = null) => {
  const patient = await Patient.findOne({ _id: id, laboratoryId, isActive: true });
  if (!patient) {
    throw ApiError.notFound('Patient not found', ERROR_CODES.NOT_FOUND);
  }

  const beforeJson = patient.toObject();

  if (data.doctorId) {
    const doctor = await Doctor.findOne({ _id: data.doctorId, laboratoryId, isActive: true });
    if (doctor) {
      patient.doctorId = doctor._id;
      patient.doctorNameSnapshot = doctor.name;
    }
  } else if (data.doctorId === null || data.doctorId === '') {
    patient.doctorId = null;
    patient.doctorNameSnapshot = 'Self';
  }

  ['title', 'name', 'age', 'ageUnit', 'gender', 'mobile', 'address'].forEach((field) => {
    if (data[field] !== undefined) {
      patient[field] = data[field];
    }
  });

  await patient.save();

  await logAuditEvent({
    laboratoryId,
    actorId: actor?._id,
    actorRole: actor?.role,
    entityType: 'Patient',
    entityId: patient._id,
    action: 'UPDATE',
    beforeJson,
    afterJson: patient.toObject(),
    req,
  });

  return patient;
};

module.exports = {
  getPatients,
  getPatientById,
  createPatient,
  updatePatient,
};
