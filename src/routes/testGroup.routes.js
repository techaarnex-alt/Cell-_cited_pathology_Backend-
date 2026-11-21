const express = require('express');
const router = express.Router();
const testGroupController = require('../controllers/testGroup.controller');
const { authenticate, authorize } = require('../middlewares/auth');
const validateRequest = require('../middlewares/validate');
const { ROLES } = require('../constants/roles');
const { createTestGroupSchema } = require('../validators/testGroup.validator');

/**
 * @openapi
 * /api/v1/test-groups:
 *   get:
 *     summary: List test groups and panels
 *     description: Retrieve all ordered investigation panels (CBC, LFT, Lipid Profile, etc.).
 *     tags:
 *       - Test Groups
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Test groups retrieved successfully
 *   post:
 *     summary: Create test group / panel
 *     tags:
 *       - Test Groups
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TestGroupRequest'
 *     responses:
 *       201:
 *         description: Test group created successfully
 */
router.get('/', authenticate, testGroupController.getTestGroups);

router.post(
  '/',
  authenticate,
  authorize(ROLES.ADMINISTRATOR, ROLES.PATHOLOGIST),
  validateRequest(createTestGroupSchema),
  testGroupController.createTestGroup
);

module.exports = router;
