const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { authenticate, authorize } = require('../middlewares/auth');
const validateRequest = require('../middlewares/validate');
const { ROLES } = require('../constants/roles');
const {
  createReportSchema,
  updateResultsSchema,
  finalizeReportSchema,
  reopenReportSchema,
  documentRequestSchema,
  queryReportSchema,
  updateReportSchema,
} = require('../validators/report.validator');

/**
 * @openapi
 * /api/v1/reports:
 *   get:
 *     summary: List reports
 *     description: Retrieve investigation reports filtered by status, patient, date, or report number.
 *     tags:
 *       - Reports
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [Draft, Final] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Reports retrieved successfully
 *   post:
 *     summary: Create Draft report
 *     description: Creates a Draft report for a registered patient, expanding panels and creating test snapshots.
 *     tags:
 *       - Reports
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReportCreateRequest'
 *     responses:
 *       201:
 *         description: Draft report created successfully
 */
router.get(
  '/',
  authenticate,
  validateRequest(queryReportSchema, 'query'),
  reportController.getReports
);

router.post(
  '/',
  authenticate,
  authorize(ROLES.ADMINISTRATOR, ROLES.RECEPTIONIST, ROLES.TECHNICIAN),
  validateRequest(createReportSchema),
  reportController.createReport
);

/**
 * @openapi
 * /api/v1/reports/{id}:
 *   get:
 *     summary: Read report
 *     description: Get full report details with snapshot patient demographics, doctor referral rate, and test investigations.
 *     tags:
 *       - Reports
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Report details retrieved
 */
router.get('/:id', authenticate, reportController.getReportById);

router.patch(
  '/:id',
  authenticate,
  authorize(ROLES.ADMINISTRATOR, ROLES.TECHNICIAN, ROLES.PATHOLOGIST, ROLES.RECEPTIONIST),
  validateRequest(updateReportSchema),
  reportController.updateReport
);

router.put(
  '/:id',
  authenticate,
  authorize(ROLES.ADMINISTRATOR, ROLES.TECHNICIAN, ROLES.PATHOLOGIST, ROLES.RECEPTIONIST),
  validateRequest(updateReportSchema),
  reportController.updateReport
);

/**
 * @openapi
 * /api/v1/reports/{id}/results:
 *   patch:
 *     summary: Save Draft results
 *     description: Save observed test values, units, reference ranges, and remarks. Rejects if report is Final.
 *     tags:
 *       - Reports
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
 *             $ref: '#/components/schemas/ResultsUpdateRequest'
 *     responses:
 *       200:
 *         description: Results saved successfully
 *       409:
 *         description: Report is already finalised and immutable
 */
router.patch(
  '/:id/results',
  authenticate,
  authorize(ROLES.ADMINISTRATOR, ROLES.TECHNICIAN, ROLES.PATHOLOGIST),
  validateRequest(updateResultsSchema),
  reportController.updateResults
);

/**
 * @openapi
 * /api/v1/reports/{id}/finalize:
 *   post:
 *     summary: Finalize report
 *     description: Finalize the report. Requires every test investigation to have an observed value. Pathologist or admin only.
 *     tags:
 *       - Reports
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FinalizeReportRequest'
 *     responses:
 *       200:
 *         description: Report finalised successfully
 *       400:
 *         description: Incomplete report (missing observed values)
 *       403:
 *         description: Only Pathologist or Administrator can finalize
 */
router.post(
  '/:id/finalize',
  authenticate,
  authorize(ROLES.ADMINISTRATOR, ROLES.PATHOLOGIST),
  validateRequest(finalizeReportSchema),
  reportController.finalizeReport
);

/**
 * @openapi
 * /api/v1/reports/{id}/reopen:
 *   post:
 *     summary: Reopen finalized report for corrections
 *     description: Controlled correction path for finalized reports. Requires authorized role and non-empty clinical justification.
 *     tags:
 *       - Reports
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
 *             $ref: '#/components/schemas/ReopenReportRequest'
 *     responses:
 *       200:
 *         description: Report reopened successfully
 */
router.post(
  '/:id/reopen',
  authenticate,
  authorize(ROLES.ADMINISTRATOR, ROLES.PATHOLOGIST),
  validateRequest(reopenReportSchema),
  reportController.reopenReport
);

/**
 * @openapi
 * /api/v1/reports/{id}/documents:
 *   post:
 *     summary: Request PDF render/document
 *     description: Generates a stable PDF document metadata entry (with or without letterhead).
 *     tags:
 *       - Reports
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               withLetterhead: { type: boolean, default: true }
 *     responses:
 *       201:
 *         description: Document generated successfully
 */
router.post(
  '/:id/documents',
  authenticate,
  validateRequest(documentRequestSchema),
  reportController.requestDocument
);

module.exports = router;
