const express = require('express');
const router = express.Router();
const documentController = require('../controllers/document.controller');
const { authenticate } = require('../middlewares/auth');

/**
 * @openapi
 * /api/v1/documents/{id}/download:
 *   get:
 *     summary: Download generated report or invoice document
 *     description: Authorizes download and logs an immutable audit event for the file retrieval.
 *     tags:
 *       - Documents
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Document download authorized
 *       404:
 *         description: Document not found
 */
router.get('/:id/download', authenticate, documentController.downloadDocument);

module.exports = router;
