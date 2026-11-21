const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patient.controller');
const { authenticate, authorize } = require('../middlewares/auth');
const validateRequest = require('../middlewares/validate');
const { ROLES } = require('../constants/roles');
const {
  createPatientSchema,
  updatePatientSchema,
  queryPatientSchema,
} = require('../validators/patient.validator');

/**
 * @openapi
 * /api/v1/patients:
 *   get:
 *     summary: List and search patients
 *     description: Retrieve registered patients with pagination and search by name, patientNumber, or mobile.
 *     tags:
 *       - Patients
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name, mobile, or patient ID
 *     responses:
 *       200:
 *         description: Patients retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardSuccessResponse'
 *   post:
 *     summary: Register patient
 *     description: Register demographic details. Optionally creates a Draft report atomically when tests/groups are selected.
 *     tags:
 *       - Patients
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PatientRequest'
 *     responses:
 *       201:
 *         description: Patient created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardSuccessResponse'
 */
router.get(
  '/',
  authenticate,
  validateRequest(queryPatientSchema, 'query'),
  patientController.getPatients
);

router.post(
  '/',
  authenticate,
  authorize(ROLES.ADMINISTRATOR, ROLES.RECEPTIONIST, ROLES.TECHNICIAN),
  validateRequest(createPatientSchema),
  patientController.createPatient
);

/**
 * @openapi
 * /api/v1/patients/{id}:
 *   get:
 *     summary: Get patient by ID
 *     description: Retrieve detailed patient demographics along with previous laboratory investigation reports.
 *     tags:
 *       - Patients
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Patient details retrieved
 *       404:
 *         description: Patient not found
 *   patch:
 *     summary: Update patient details
 *     description: Update demographic details of an existing registered patient.
 *     tags:
 *       - Patients
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               age: { type: number }
 *               gender: { type: string }
 *               mobile: { type: string }
 *               address: { type: string }
 *               doctorId: { type: string }
 *     responses:
 *       200:
 *         description: Patient updated successfully
 */
router.get('/:id', authenticate, patientController.getPatientById);

router.patch(
  '/:id',
  authenticate,
  authorize(ROLES.ADMINISTRATOR, ROLES.RECEPTIONIST),
  validateRequest(updatePatientSchema),
  patientController.updatePatient
);

module.exports = router;
