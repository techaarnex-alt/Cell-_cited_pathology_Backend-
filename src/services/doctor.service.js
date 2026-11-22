const Doctor = require('../models/Doctor');
const Report = require('../models/Report');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const { logAuditEvent } = require('./audit.service');

const generateDoctorCode = async (laboratoryId) => {
  const count = await Doctor.countDocuments({ laboratoryId });
  return `DR-${String(count + 1).padStart(3, '0')}`;
};

const getDoctors = async (laboratoryId, query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 50));
  const skip = (page - 1) * limit;

  const filter = { laboratoryId, isActive: true };

  if (query.search) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { name: searchRegex },
      { doctorCode: searchRegex },
      { specialty: searchRegex },
      { mobile: searchRegex },
    ];
  }

  const [doctors, total] = await Promise.all([
    Doctor.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Doctor.countDocuments(filter),
  ]);

  return {
    doctors,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

const getDoctorById = async (laboratoryId, id) => {
  const doctor = await Doctor.findOne({ _id: id, laboratoryId, isActive: true }).lean();
  if (!doctor) {
    throw ApiError.notFound('Doctor not found', ERROR_CODES.NOT_FOUND);
  }
  return doctor;
};

const createDoctor = async (laboratoryId, data, actor = null, req = null) => {
  const doctorCode = data.doctorCode || (await generateDoctorCode(laboratoryId));

  const doctor = await Doctor.create({
    laboratoryId,
    doctorCode,
    name: data.name.trim(),
    specialty: data.specialty ? data.specialty.trim() : '',
    mobile: data.mobile ? data.mobile.trim() : '',
    address: data.address ? data.address.trim() : '',
    referralPercentage: Number(data.referralPercentage || 0),
  });

  await logAuditEvent({
    laboratoryId,
    actorId: actor?._id,
    actorRole: actor?.role,
    entityType: 'Doctor',
    entityId: doctor._id,
    action: 'CREATE',
    afterJson: doctor.toObject(),
    req,
  });

  return doctor;
};

const updateDoctor = async (laboratoryId, id, data, actor = null, req = null) => {
  const doctor = await Doctor.findOne({ _id: id, laboratoryId, isActive: true });
  if (!doctor) {
    throw ApiError.notFound('Doctor not found', ERROR_CODES.NOT_FOUND);
  }

  const beforeJson = doctor.toObject();

  ['name', 'specialty', 'mobile', 'address', 'referralPercentage', 'isActive'].forEach((field) => {
    if (data[field] !== undefined) {
      doctor[field] = data[field];
    }
  });

  await doctor.save();

  await logAuditEvent({
    laboratoryId,
    actorId: actor?._id,
    actorRole: actor?.role,
    entityType: 'Doctor',
    entityId: doctor._id,
    action: 'UPDATE',
    beforeJson,
    afterJson: doctor.toObject(),
    req,
  });

  return doctor;
};

const getDoctorEarnings = async (laboratoryId, doctorId, options = {}) => {
  const doctor = await Doctor.findOne({ _id: doctorId, laboratoryId, isActive: true }).lean();
  if (!doctor) {
    throw ApiError.notFound('Doctor not found', ERROR_CODES.NOT_FOUND);
  }

  const filter = {
    laboratoryId,
    doctorId: doctor._id,
  };

  if (options.startDate || options.endDate) {
    filter.createdAt = {};
    if (options.startDate) filter.createdAt.$gte = new Date(options.startDate);
    if (options.endDate) filter.createdAt.$lte = new Date(options.endDate);
  }

  // Fetch reports to calculate historical earnings strictly using snapshot percentage
  const reports = await Report.find(filter)
    .select('reportNumber fee paid doctorSnapshot createdAt')
    .sort({ createdAt: -1 })
    .lean();

  let totalBilled = 0;
  let totalEarnings = 0;

  const itemizedReports = reports.map((rep) => {
    const fee = Number(rep.fee || 0);
    // Crucial rule: Use doctorSnapshot.referralPercentage, NEVER current doctor.referralPercentage
    const snapshotPercentage = rep.doctorSnapshot?.referralPercentage ?? 0;
    const earning = (fee * snapshotPercentage) / 100;

    totalBilled += fee;
    totalEarnings += earning;

    return {
      reportId: rep._id,
      reportNumber: rep.reportNumber,
      fee,
      paid: rep.paid,
      referralPercentageSnapshot: snapshotPercentage,
      earning,
      createdAt: rep.createdAt,
    };
  });

  return {
    doctor: {
      id: doctor._id,
      doctorCode: doctor.doctorCode,
      name: doctor.name,
      currentReferralPercentage: doctor.referralPercentage,
    },
    summary: {
      reportCount: reports.length,
      totalBilled,
      totalEarnings,
    },
    reports: itemizedReports,
  };
};

module.exports = {
  getDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  getDoctorEarnings,
};
