const express = require('express');
const router = express.Router();
const testController = require('../controllers/test.controller');
const { authenticate, authorize } = require('../middlewares/auth');
const validateRequest = require('../middlewares/validate');
const { ROLES } = require('../constants/roles');
const {
  createTestSchema,
  updateTestSchema,
  queryTestSchema,
} = require('../validators/test.validator');

/**
 * @openapi
 * /api/v1/tests:
 *   get:
 *     summary: List catalogue tests
 *     description: Retrieve all available laboratory tests with categories, biological reference ranges, units, and rates.
 *     tags:
 *       - Tests
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 100 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Tests retrieved successfully
 *   post:
 *     summary: Add test to catalogue
 *     description: Create a new investigation in the test catalogue.
 *     tags:
 *       - Tests
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TestRequest'
 *     responses:
 *       201:
 *         description: Test created successfully
 */
router.get(
  '/',
  authenticate,
  validateRequest(queryTestSchema, 'query'),
  testController.getTests
);

router.post(
  '/',
  authenticate,
  authorize(ROLES.ADMINISTRATOR, ROLES.PATHOLOGIST),
  validateRequest(createTestSchema),
  testController.createTest
);

/**
 * @openapi
 * /api/v1/tests/{id}:
 *   get:
 *     summary: Get test details
 *     tags:
 *       - Tests
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Test details retrieved
 *   patch:
 *     summary: Update test in catalogue
 *     description: Update name, unit, reference range, or rate of a test. Existing historical reports remain unchanged.
 *     tags:
 *       - Tests
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
 *               category: { type: string }
 *               unit: { type: string }
 *               referenceRange: { type: string }
 *               rate: { type: number }
 *               alertable: { type: boolean }
 *     responses:
 *       200:
 *         description: Test updated successfully
 *   delete:
 *     summary: Soft-delete/retire test
 *     description: Retire a test from the active catalogue without breaking historical report links.
 *     tags:
 *       - Tests
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Test retired successfully
 */
router.get('/:id', authenticate, testController.getTestById);

router.patch(
  '/:id',
  authenticate,
  authorize(ROLES.ADMINISTRATOR, ROLES.PATHOLOGIST),
  validateRequest(updateTestSchema),
  testController.updateTest
);

router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.ADMINISTRATOR, ROLES.PATHOLOGIST),
  testController.deleteTest
);

module.exports = router;
