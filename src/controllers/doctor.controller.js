const catchAsync = require('../utils/catchAsync');
const { sendSuccess } = require('../utils/response');
const doctorService = require('../services/doctor.service');

const getDoctors = catchAsync(async (req, res) => {
  const result = await doctorService.getDoctors(req.laboratoryId, req.query);
  return sendSuccess(res, 200, 'Doctors retrieved successfully', result.doctors, {
    pagination: result.pagination,
  });
});

const createDoctor = catchAsync(async (req, res) => {
  const doctor = await doctorService.createDoctor(req.laboratoryId, req.body, req.user, req);
  return sendSuccess(res, 201, 'Doctor created successfully', doctor);
});

const updateDoctor = catchAsync(async (req, res) => {
  const doctor = await doctorService.updateDoctor(
    req.laboratoryId,
    req.params.id,
    req.body,
    req.user,
    req
  );
  return sendSuccess(res, 200, 'Doctor updated successfully', doctor);
});

const getDoctorEarnings = catchAsync(async (req, res) => {
  const earnings = await doctorService.getDoctorEarnings(
    req.laboratoryId,
    req.params.id,
    req.query
  );
  return sendSuccess(res, 200, 'Doctor referral earnings retrieved successfully', earnings);
});

module.exports = {
  getDoctors,
  createDoctor,
  updateDoctor,
  getDoctorEarnings,
};
