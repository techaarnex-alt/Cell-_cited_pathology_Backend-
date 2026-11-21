const express = require('express');
const router = express.Router();
const healthController = require('../controllers/health.controller');

/**
 * @openapi
 * /api/v1/health:
 *   get:
 *     summary: System health check
 *     description: Health and uptime status of the backend API service and MongoDB Atlas connection.
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: System operational
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardSuccessResponse'
 */
router.get('/health', healthController.checkHealth);

module.exports = router;
