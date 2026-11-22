const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctor.controller');
const { authenticate, authorize } = require('../middlewares/auth');
const validateRequest = require('../middlewares/validate');
const { ROLES } = require('../constants/roles');
const {
  createDoctorSchema,
  updateDoctorSchema,
  queryDoctorSchema,
} = require('../validators/doctor.validator');

/**
 * @openapi
 * /api/v1/doctors:
 *   get:
 *     summary: List referring doctors
 *     description: Retrieve all referring doctors and clinics with referral percentages.
 *     tags:
 *       - Doctors
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Doctors retrieved successfully
 *   post:
 *     summary: Add referring doctor
 *     description: Save a new referring doctor or organisation with agreed referral percentage.
 *     tags:
 *       - Doctors
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DoctorRequest'
 *     responses:
 *       201:
 *         description: Doctor created successfully
 */
router.get(
  '/',
  authenticate,
  validateRequest(queryDoctorSchema, 'query'),
  doctorController.getDoctors
);

router.post(
  '/',
  authenticate,
  authorize(ROLES.ADMINISTRATOR, ROLES.RECEPTIONIST),
  validateRequest(createDoctorSchema),
  doctorController.createDoctor
);

/**
 * @openapi
 * /api/v1/doctors/{id}:
 *   patch:
 *     summary: Update referring doctor
 *     description: Edit doctor name, specialty, mobile, clinic address, or referral percentage. Note that historical report referral earnings remain unchanged.
 *     tags:
 *       - Doctors
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               specialty: { type: string }
 *               mobile: { type: string }
 *               address: { type: string }
 *               referralPercentage: { type: number }
 *     responses:
 *       200:
 *         description: Doctor updated successfully
 */
router.patch(
  '/:id',
  authenticate,
  authorize(ROLES.ADMINISTRATOR, ROLES.RECEPTIONIST),
  validateRequest(updateDoctorSchema),
  doctorController.updateDoctor
);

/**
 * @openapi
 * /api/v1/doctors/{id}/earnings:
 *   get:
 *     summary: Get doctor referral earnings
 *     description: Calculate referral earnings based strictly on report doctor percentage snapshots.
 *     tags:
 *       - Doctors
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Doctor earnings calculated successfully
 */
router.get('/:id/earnings', authenticate, doctorController.getDoctorEarnings);

module.exports = router;
