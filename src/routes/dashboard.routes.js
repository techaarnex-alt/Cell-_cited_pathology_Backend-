const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { authenticate } = require('../middlewares/auth');

/**
 * @openapi
 * /api/v1/dashboard/stats:
 *   get:
 *     summary: Dashboard operational statistics
 *     description: Real-time aggregated statistics for patient counts, draft reports, ready reports, billing metrics, and recent activity.
 *     tags:
 *       - Dashboard
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardSuccessResponse'
 */
router.get('/stats', authenticate, dashboardController.getStats);

module.exports = router;
