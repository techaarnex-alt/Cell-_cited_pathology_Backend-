const catchAsync = require('../utils/catchAsync');
const { sendSuccess } = require('../utils/response');
const patientService = require('../services/patient.service');

const getPatients = catchAsync(async (req, res) => {
  const result = await patientService.getPatients(req.laboratoryId, req.query);
  return sendSuccess(res, 200, 'Patients retrieved successfully', result.patients, {
    pagination: result.pagination,
  });
});

const getPatientById = catchAsync(async (req, res) => {
  const patient = await patientService.getPatientById(req.laboratoryId, req.params.id);
  return sendSuccess(res, 200, 'Patient retrieved successfully', patient);
});

const createPatient = catchAsync(async (req, res) => {
  const result = await patientService.createPatient(req.laboratoryId, req.body, req.user, req);
  return sendSuccess(res, 201, 'Patient created successfully', result);
});

const updatePatient = catchAsync(async (req, res) => {
  const patient = await patientService.updatePatient(
    req.laboratoryId,
    req.params.id,
    req.body,
    req.user,
    req
  );
  return sendSuccess(res, 200, 'Patient updated successfully', patient);
});

module.exports = {
  getPatients,
  getPatientById,
  createPatient,
  updatePatient,
};
