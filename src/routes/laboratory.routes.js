const express = require('express');
const router = express.Router();
const laboratoryController = require('../controllers/laboratory.controller');
const { authenticate, authorize } = require('../middlewares/auth');
const { ROLES } = require('../constants/roles');

/**
 * @openapi
 * /api/v1/laboratory:
 *   get:
 *     summary: Get laboratory profile
 *     description: Retrieve establishment certificate, address, contact numbers, signatory, and branding details.
 *     tags:
 *       - Laboratory Profile
 *     responses:
 *       200:
 *         description: Laboratory profile retrieved successfully
 *   patch:
 *     summary: Update laboratory profile
 *     description: Update establishment address, phone numbers, email, or signatory information (Administrator only).
 *     tags:
 *       - Laboratory Profile
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               address: { type: string }
 *               phones: { type: array, items: { type: string } }
 *               email: { type: string }
 *               medicalCertificate: { type: string }
 *               authorisedSignatory: { type: string }
 *               registrationDetails: { type: string }
 *     responses:
 *       200:
 *         description: Laboratory profile updated successfully
 */
router.get('/', laboratoryController.getProfile);
router.patch(
  '/',
  authenticate,
  authorize(ROLES.ADMINISTRATOR),
  laboratoryController.updateProfile
);

module.exports = router;
